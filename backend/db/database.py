from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import DATABASE_URL

# check_same_thread=False: SQLite por defecto solo permite usar la conexión
# desde el hilo que la abrió; FastAPI puede atender cada request en un hilo
# distinto, así que hace falta relajar esa restricción aquí.
connect_args = {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
