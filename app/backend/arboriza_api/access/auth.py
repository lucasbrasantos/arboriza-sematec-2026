"""Autenticação local com senhas derivadas e sessões revogáveis."""
import hashlib
import hmac
import secrets
import sqlite3
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

from ..core.database import connect

router = APIRouter(prefix='/api/auth', tags=['Acesso'])
users_router = APIRouter(prefix='/api/users', tags=['Usuários'])
bearer = HTTPBearer(auto_error=False)
ITERATIONS = 600_000
SESSION_SECONDS = 8 * 60 * 60


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), ITERATIONS).hex()
    return f'{ITERATIONS}${salt}${digest}'


def verify_password(password: str, stored: str) -> bool:
    try:
        count, salt, expected = stored.split('$')
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), int(count)).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        raise HTTPException(401, 'Autenticação necessária.')
    with connect() as db:
        user = db.execute('''SELECT users.id, users.username, users.role FROM sessions
            JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=?
            AND sessions.expires_at>? AND users.active=1''',
            (token_hash(credentials.credentials), int(time.time()))).fetchone()
    if not user:
        raise HTTPException(401, 'Sessão inválida ou expirada.')
    return dict(user)


def admin(user=Depends(current_user)):
    if user['role'] != 'admin':
        raise HTTPException(403, 'Apenas administradores podem gerenciar usuários.')
    return user


class Credentials(BaseModel):
    model_config = ConfigDict(extra='forbid')
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class NewUser(Credentials):
    role: str = Field(pattern='^(admin|operator)$')


@router.post('/login')
def login(body: Credentials):
    identity = hashlib.sha256(body.username.strip().casefold().encode()).hexdigest()
    timestamp = int(time.time())
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        attempt = db.execute('SELECT failures, last_failure FROM login_attempts WHERE identity=?', (identity,)).fetchone()
        if attempt and attempt['failures'] >= 5 and timestamp - attempt['last_failure'] < 300:
            raise HTTPException(429, 'Muitas tentativas. Aguarde cinco minutos.')
        user = db.execute('SELECT * FROM users WHERE username=?', (body.username.strip(),)).fetchone()
        valid = bool(user and user['active'] and verify_password(body.password, user['password_hash']))
        if not valid:
            failures = (attempt['failures'] if attempt and timestamp - attempt['last_failure'] < 300 else 0) + 1
            db.execute('INSERT OR REPLACE INTO login_attempts VALUES(?,?,?)', (identity, failures, timestamp))
        else:
            db.execute('DELETE FROM login_attempts WHERE identity=?', (identity,))
            token = secrets.token_urlsafe(32)
            expires = timestamp + SESSION_SECONDS
            db.execute('DELETE FROM sessions WHERE expires_at<=?', (timestamp,))
            db.execute('INSERT INTO sessions VALUES(?,?,?)', (token_hash(token), user['id'], expires))
    if not valid:
        raise HTTPException(401, 'Usuário ou senha inválidos.')
    return {'access_token': token, 'token_type': 'bearer', 'expires_at': expires,
            'user': {'id': user['id'], 'username': user['username'], 'role': user['role']}}


@router.get('/me')
def me(user=Depends(current_user)):
    return user


@router.post('/logout', status_code=204)
def logout(credentials: HTTPAuthorizationCredentials = Depends(bearer), user=Depends(current_user)):
    with connect() as db:
        db.execute('DELETE FROM sessions WHERE token_hash=?', (token_hash(credentials.credentials),))


@users_router.post('', status_code=201)
def create_user(body: NewUser, _admin=Depends(admin)):
    username = body.username.strip()
    if not username or len(body.password) < 12:
        raise HTTPException(422, 'Informe usuário e senha com pelo menos 12 caracteres.')
    try:
        with connect() as db:
            cursor = db.execute('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)',
                                (username, hash_password(body.password), body.role))
            ident = cursor.lastrowid
    except sqlite3.IntegrityError as error:
        raise HTTPException(409, 'Nome de usuário já cadastrado.') from error
    return {'id': ident, 'username': username, 'role': body.role}


@users_router.get('')
def list_users(_admin=Depends(admin)):
    with connect() as db:
        return [dict(row) for row in db.execute('SELECT id, username, role, active FROM users ORDER BY username')]


class PasswordReset(BaseModel):
    model_config = ConfigDict(extra='forbid')
    password: str = Field(min_length=12, max_length=256)


@users_router.post('/{user_id}/senha', status_code=204)
def reset_password(user_id: int, body: PasswordReset, _admin=Depends(admin)):
    with connect() as db:
        result = db.execute('UPDATE users SET password_hash=? WHERE id=?', (hash_password(body.password), user_id))
        if not result.rowcount:
            raise HTTPException(404, 'Usuário não encontrado.')
        db.execute('DELETE FROM sessions WHERE user_id=?', (user_id,))


class UserState(BaseModel):
    model_config = ConfigDict(extra='forbid')
    active: bool


@users_router.patch('/{user_id}/estado')
def set_user_state(user_id: int, body: UserState, _admin=Depends(admin)):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        target = db.execute('SELECT id, username, role, active FROM users WHERE id=?', (user_id,)).fetchone()
        if not target:
            raise HTTPException(404, 'Usuário não encontrado.')
        if not body.active and target['role'] == 'admin' and target['active']:
            count = db.execute("SELECT count(*) FROM users WHERE role='admin' AND active=1").fetchone()[0]
            if count <= 1:
                raise HTTPException(409, 'O último administrador ativo não pode ser desativado.')
        db.execute('UPDATE users SET active=? WHERE id=?', (int(body.active), user_id))
        if not body.active:
            db.execute('DELETE FROM sessions WHERE user_id=?', (user_id,))
    return {'id': user_id, 'active': body.active}
