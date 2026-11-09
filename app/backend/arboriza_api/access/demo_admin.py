"""Create the documented demo administrator in a clean local database only."""
import sqlite3

from .auth import hash_password
from ..core.database import connect, initialize

USERNAME = 'demo'
PASSWORD = 'ArborizaDemo2026!'


def main():
    initialize()
    try:
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute('SELECT 1 FROM users LIMIT 1').fetchone():
                raise SystemExit('Já existem usuários. A conta demonstrativa não foi criada nem alterada.')
            db.execute('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)',
                       (USERNAME, hash_password(PASSWORD), 'admin'))
    except sqlite3.IntegrityError as error:
        raise SystemExit('Não foi possível criar a conta demonstrativa.') from error
    print('Conta administrativa local criada:')
    print(f'  usuário: {USERNAME}')
    print(f'  senha: {PASSWORD}')
    print('Use apenas no ambiente local de demonstração, vinculado a 127.0.0.1.')


if __name__ == '__main__':
    main()
