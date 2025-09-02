"""
Calibre ORM models copied from CWA reference with minimal dependencies
"""
import os
import json
from datetime import datetime, timezone
from sqlalchemy import create_engine, Table, Column, ForeignKey, CheckConstraint
from sqlalchemy import String, Integer, Boolean, TIMESTAMP, Float
from sqlalchemy.orm import relationship, sessionmaker, scoped_session, declarative_base
from sqlalchemy.pool import StaticPool

Base = declarative_base()

# Association tables (copied from CWA)
books_authors_link = Table('books_authors_link', Base.metadata,
                           Column('book', Integer, ForeignKey('books.id'), primary_key=True),
                           Column('author', Integer, ForeignKey('authors.id'), primary_key=True)
                           )

books_tags_link = Table('books_tags_link', Base.metadata,
                        Column('book', Integer, ForeignKey('books.id'), primary_key=True),
                        Column('tag', Integer, ForeignKey('tags.id'), primary_key=True)
                        )

books_series_link = Table('books_series_link', Base.metadata,
                          Column('book', Integer, ForeignKey('books.id'), primary_key=True),
                          Column('series', Integer, ForeignKey('series.id'), primary_key=True)
                          )

books_ratings_link = Table('books_ratings_link', Base.metadata,
                           Column('book', Integer, ForeignKey('books.id'), primary_key=True),
                           Column('rating', Integer, ForeignKey('ratings.id'), primary_key=True)
                           )

books_languages_link = Table('books_languages_link', Base.metadata,
                             Column('book', Integer, ForeignKey('books.id'), primary_key=True),
                             Column('lang_code', Integer, ForeignKey('languages.id'), primary_key=True)
                             )

books_publishers_link = Table('books_publishers_link', Base.metadata,
                              Column('book', Integer, ForeignKey('books.id'), primary_key=True),
                              Column('publisher', Integer, ForeignKey('publishers.id'), primary_key=True)
                              )

# ORM Models (copied from CWA)
class Identifiers(Base):
    __tablename__ = 'identifiers'

    id = Column(Integer, primary_key=True)
    book = Column(Integer, ForeignKey('books.id'), nullable=False)
    type = Column(String(collation='NOCASE'), nullable=False, default="isbn")
    val = Column(String(collation='NOCASE'), nullable=False)

    def __init__(self, val, id_type, book):
        super().__init__()
        self.val = val
        self.type = id_type
        self.book = book

    def formatType(self):
        if self.type == "amazon":
            return "Amazon"
        elif self.type == "isbn":
            return "ISBN"
        elif self.type == "doi":
            return "DOI"
        elif self.type == "douban":
            return "Douban"
        elif self.type == "goodreads":
            return "Goodreads"
        elif self.type == "google":
            return "Google Books"
        elif self.type == "kobo":
            return "Kobo"
        elif self.type == "lubimyczytac":
            return "Lubimyczytac"
        elif self.type == "litres":
            return "ЛитРес"
        elif self.type == "databazeknih":
            return "Databáze knih"
        elif self.type == "zlib":
            return "Z-Library"
        else:
            return self.type

    def __repr__(self):
        return "<Identifiers('{0}:{1}')>".format(self.type, self.val)

class Comments(Base):
    __tablename__ = 'comments'

    id = Column(Integer, primary_key=True)
    book = Column(Integer, ForeignKey('books.id'), nullable=False)
    text = Column(String(collation='NOCASE'), nullable=False)

    def __init__(self, text, book):
        super().__init__()
        self.text = text
        self.book = book

    def get(self):
        return self.text

    def __repr__(self):
        return "<Comments('{0}')>".format(self.text)

class Tags(Base):
    __tablename__ = 'tags'

    id = Column(Integer, primary_key=True)
    name = Column(String(collation='NOCASE'), unique=True, nullable=False)

    def __init__(self, name):
        super().__init__()
        self.name = name

    def get(self):
        return self.name

    def __repr__(self):
        return "<Tags('{0}')>".format(self.name)

class Authors(Base):
    __tablename__ = 'authors'

    id = Column(Integer, primary_key=True)
    name = Column(String(collation='NOCASE'), unique=True, nullable=False)
    sort = Column(String(collation='NOCASE'))
    link = Column(String, nullable=False, default="")

    def __init__(self, name, sort, link):
        super().__init__()
        self.name = name
        self.sort = sort
        self.link = link

    def get(self):
        return self.name

    def __repr__(self):
        return "<Authors('{0},{1}{2}')>".format(self.name, self.sort, self.link)

class Series(Base):
    __tablename__ = 'series'

    id = Column(Integer, primary_key=True)
    name = Column(String(collation='NOCASE'), unique=True, nullable=False)
    sort = Column(String(collation='NOCASE'))

    def __init__(self, name, sort):
        super().__init__()
        self.name = name
        self.sort = sort

    def get(self):
        return self.name

    def __repr__(self):
        return "<Series('{0},{1}')>".format(self.name, self.sort)

class Ratings(Base):
    __tablename__ = 'ratings'

    id = Column(Integer, primary_key=True)
    rating = Column(Integer, CheckConstraint('rating>-1 AND rating<11'), unique=True)

    def __init__(self, rating):
        super().__init__()
        self.rating = rating

    def get(self):
        return self.rating

    def __eq__(self, other):
        return self.rating == other

    def __repr__(self):
        return "<Ratings('{0}')>".format(self.rating)

class Languages(Base):
    __tablename__ = 'languages'

    id = Column(Integer, primary_key=True)
    lang_code = Column(String(collation='NOCASE'), nullable=False, unique=True)

    def __init__(self, lang_code):
        super().__init__()
        self.lang_code = lang_code

    def get(self):
        return self.lang_code

    def __repr__(self):
        return "<Languages('{0}')>".format(self.lang_code)

class Publishers(Base):
    __tablename__ = 'publishers'

    id = Column(Integer, primary_key=True)
    name = Column(String(collation='NOCASE'), nullable=False, unique=True)
    sort = Column(String(collation='NOCASE'))

    def __init__(self, name, sort):
        super().__init__()
        self.name = name
        self.sort = sort

    def get(self):
        return self.name

    def __repr__(self):
        return "<Publishers('{0},{1}')>".format(self.name, self.sort)

class Data(Base):
    __tablename__ = 'data'

    id = Column(Integer, primary_key=True)
    book = Column(Integer, ForeignKey('books.id'), nullable=False)
    format = Column(String(collation='NOCASE'), nullable=False)
    uncompressed_size = Column(Integer, nullable=False)
    name = Column(String, nullable=False)

    def __init__(self, book, book_format, uncompressed_size, name):
        super().__init__()
        self.book = book
        self.format = book_format
        self.uncompressed_size = uncompressed_size
        self.name = name

    def get(self):
        return self.format

    def __repr__(self):
        return "<Data('{0},{1}{2}{3}')>".format(self.book, self.format, self.uncompressed_size, self.name)

class Books(Base):
    __tablename__ = 'books'

    DEFAULT_PUBDATE = datetime(101, 1, 1, 0, 0, 0, 0)  # ("0101-01-01 00:00:00+00:00")

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(collation='NOCASE'), nullable=False, default='Unknown')
    sort = Column(String(collation='NOCASE'))
    author_sort = Column(String(collation='NOCASE'))
    timestamp = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc))
    pubdate = Column(TIMESTAMP, default=DEFAULT_PUBDATE)
    series_index = Column(String, nullable=False, default="1.0")
    last_modified = Column(TIMESTAMP, default=lambda: datetime.now(timezone.utc))
    path = Column(String, default="", nullable=False)
    has_cover = Column(Integer, default=0)
    uuid = Column(String)
    isbn = Column(String(collation='NOCASE'), default="")
    flags = Column(Integer, nullable=False, default=1)

    authors = relationship(Authors, secondary=books_authors_link, backref='books')
    tags = relationship(Tags, secondary=books_tags_link, backref='books', order_by="Tags.name")
    comments = relationship(Comments, backref='books')
    data = relationship(Data, backref='books')
    series = relationship(Series, secondary=books_series_link, backref='books')
    ratings = relationship(Ratings, secondary=books_ratings_link, backref='books')
    languages = relationship(Languages, secondary=books_languages_link, backref='books')
    publishers = relationship(Publishers, secondary=books_publishers_link, backref='books')
    identifiers = relationship(Identifiers, backref='books')

    def __init__(self, title, sort, author_sort, timestamp, pubdate, series_index, last_modified, path, has_cover,
                 authors, tags, languages=None):
        super().__init__()
        self.title = title
        self.sort = sort
        self.author_sort = author_sort
        self.timestamp = timestamp
        self.pubdate = pubdate
        self.series_index = series_index
        self.last_modified = last_modified
        self.path = path
        self.has_cover = (has_cover is not None)

    def __repr__(self):
        return "<Books('{0},{1}{2}{3}{4}{5}{6}{7}{8}')>".format(self.title, self.sort, self.author_sort,
                                                                self.timestamp, self.pubdate, self.series_index,
                                                                self.last_modified, self.path, self.has_cover)

    @property
    def atom_timestamp(self):
        return self.timestamp.strftime('%Y-%m-%dT%H:%M:%S+00:00') or ''
