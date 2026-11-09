"""Criação local e única do administrador inicial."""
import getpass
import sqlite3

from .auth import hash_password
from ..core.database import connect, initialize


def main():
    initialize()
    with connect() as db:
        if db.execute('SELECT 1 FROM users LIMIT 1').fetchone():
            raise SystemExit('Já existem usuários; a criação inicial está desativada.')
    username = input('Usuário administrador: ').strip()
    password = getpass.getpass('Senha (mínimo 12 caracteres): ')
    if not username or len(username) > 100 or len(password) < 12 or len(password) > 256:
        raise SystemExit('Usuário ou senha inválidos.')
    if password != getpass.getpass('Confirme a senha: '):
        raise SystemExit('As senhas não coincidem.')
    try:
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT 1 FROM users LIMIT 1').fetchone():
                raise SystemExit('Já existem usuários; criação inicial cancelada.')
            db.execute('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)',
                       (username, hash_password(password), 'admin'))
    except sqlite3.IntegrityError as error:
        raise SystemExit('Não foi possível criar o administrador.') from error
    print('Administrador inicial criado.')


if __name__ == '__main__':
    main()
