from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import DATABASE_URL

# check_same_thread=False: SQLite por defecto solo permite usar la conexión
# desde el hilo que la abrió; FastAPI puede atender cada request en un hilo
# distinto, así que hace falta relajar esa restricción aquí.
connect_args = {'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
# expire_on_commit=False: por defecto, SQLAlchemy expira los objetos tras
# cada commit() y dispara un SELECT de refresco en la próxima lectura de
# atributo. Ese SELECT corre en una transacción nueva, sin el contexto de
# tenant que fija RLS (SET LOCAL solo dura la transacción del commit), así
# que quedaría bloqueado por las políticas. Con expire_on_commit=False los
# objetos conservan sus valores en memoria después del commit, sin I/O
# adicional — evita el problema y de paso ahorra una consulta por request.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
