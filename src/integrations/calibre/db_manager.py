"""
Direct Calibre metadata.db access using CWA ORM models
"""
import os
from pathlib import Path
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, scoped_session
from sqlalchemy.pool import StaticPool
from typing import List, Dict, Any, Optional
import logging

# Import the proper CWA Calibre models
from .models import (
    Books, Authors, Series, Tags, Languages, Data, Comments, Ratings, Identifiers,
    books_authors_link, books_tags_link, books_series_link, books_ratings_link,
    books_languages_link, books_publishers_link
)

logger = logging.getLogger(__name__)

def sanitize_author_name(author_name: str) -> str:
    """
    Sanitize author name for duplicate detection.
    Handles various formats and characters that might cause false mismatches.
    
    Examples:
    - "Hannah| Kristin" -> "Kristin Hannah"
    - "Brown, Dan" -> "Dan Brown"
    - "King|Stephen" -> "Stephen King"
    - "  Smith , John  " -> "John Smith"
    """
    if not author_name:
        return ""
    
    # First handle pipe character cases - assume it's separating Last|First
    if '|' in author_name:
        parts = author_name.split('|', 1)  # Split on first pipe only
        if len(parts) == 2:
            last = parts[0].strip()
            first = parts[1].strip()
            if last and first:
                # Convert "Last|First" to "First Last"
                cleaned = f"{first} {last}"
            else:
                # Fallback: just remove pipes
                cleaned = author_name.replace('|', ' ').strip()
        else:
            cleaned = author_name.replace('|', ' ').strip()
    else:
        cleaned = author_name.strip()
    
    # Handle "Last, First" format (but be careful not to break multiple authors)
    if ',' in cleaned:
        parts = [part.strip() for part in cleaned.split(',')]
        
        # Check if this is a single "Last, First" format vs multiple authors
        if len(parts) == 2 and parts[0] and parts[1]:
            # Check if this looks like "Last, First" format
            # Last name should be a single word, first name can be multiple words
            if not ' ' in parts[0] and len(parts[1].split()) <= 3:
                # Convert "Last, First" to "First Last"
                cleaned = f"{parts[1]} {parts[0]}"
            else:
                # Keep as-is (might be multiple authors or complex name)
                cleaned = ', '.join(parts)
        elif len(parts) > 2:
            # Multiple authors - process each pair
            processed_parts = []
            i = 0
            while i < len(parts):
                if i + 1 < len(parts):
                    # Check if current and next part form a "Last, First" pair
                    if not ' ' in parts[i] and len(parts[i + 1].split()) <= 3:
                        # This looks like "Last, First" - convert it
                        processed_parts.append(f"{parts[i + 1]} {parts[i]}")
                        i += 2  # Skip the next part
                        continue
                
                # Not a "Last, First" pair, keep as-is
                processed_parts.append(parts[i])
                i += 1
            
            cleaned = ', '.join(processed_parts)
    
    # Clean up extra whitespace
    cleaned = ' '.join(cleaned.split())
    
    return cleaned

class CalibreDBManager:
    def __init__(self, metadata_db_path: str):
        """Initialize connection to Calibre metadata.db"""
        self.db_path = Path(metadata_db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"Metadata database not found: {metadata_db_path}")
        
        # Create SQLAlchemy engine for Calibre database
        self.engine = create_engine(
            f'sqlite:///{self.db_path}',
            poolclass=StaticPool,
            connect_args={'check_same_thread': False},
            echo=False  # Set to True for SQL debugging
        )
        
        # Create session factory
        self.Session = scoped_session(sessionmaker(bind=self.engine))
    
    def get_session(self):
        """Get a database session"""
        return self.Session()
    
    def close_session(self, session):
        """Close a database session"""
        session.close()
    
    def get_books(self, page: int = 1, per_page: int = 18, search: str = None, 
                  sort: str = 'new') -> Dict[str, Any]:
        """Get books from Calibre library with pagination"""
        session = self.get_session()
        try:
            # Base query with proper joins like CWA does
            query = session.query(Books)
            
            # Apply search filter if provided
            if search:
                search_term = f"%{search}%"
                # Add joins needed for search
                query = query.outerjoin(books_authors_link, Books.id == books_authors_link.c.book)
                query = query.outerjoin(Authors)
                query = query.outerjoin(books_series_link, Books.id == books_series_link.c.book)
                query = query.outerjoin(Series)
                query = query.filter(
                    Books.title.like(search_term) |
                    Authors.name.like(search_term) |
                    Series.name.like(search_term)
                ).distinct()
            
            # Apply sorting
            if sort == 'new':
                # Sort by date added, newest first
                query = query.order_by(Books.timestamp.desc())
            elif sort == 'old':
                # Sort by date added, oldest first
                query = query.order_by(Books.timestamp.asc())
            elif sort == 'abc':
                # Sort title A-Z
                query = query.order_by(Books.sort.asc())
            elif sort == 'zyx':
                # Sort title Z-A
                query = query.order_by(Books.sort.desc())
            elif sort in ['authaz', 'author']:
                # Sort authors A-Z (keeping 'author' for backward compatibility)
                if not search:
                    query = query.outerjoin(books_authors_link, Books.id == books_authors_link.c.book)
                    query = query.outerjoin(Authors)
                query = query.order_by(Authors.sort.asc())
            elif sort == 'authza':
                # Sort authors Z-A
                if not search:
                    query = query.outerjoin(books_authors_link, Books.id == books_authors_link.c.book)
                    query = query.outerjoin(Authors)
                query = query.order_by(Authors.sort.desc())
            elif sort == 'pubnew':
                # Sort by publication date, newest first
                query = query.order_by(Books.pubdate.desc().nulls_last())
            elif sort == 'pubold':
                # Sort by publication date, oldest first
                query = query.order_by(Books.pubdate.asc().nulls_last())
            elif sort == 'seriesasc':
                # Sort by series index ascending
                if not search:
                    query = query.outerjoin(books_series_link, Books.id == books_series_link.c.book)
                    query = query.outerjoin(Series)
                query = query.order_by(books_series_link.c.series_index.asc().nulls_last())
            elif sort == 'seriesdesc':
                # Sort by series index descending
                if not search:
                    query = query.outerjoin(books_series_link, Books.id == books_series_link.c.book)
                    query = query.outerjoin(Series)
                query = query.order_by(books_series_link.c.series_index.desc().nulls_first())
            elif sort == 'hotasc':
                # Sort by download count ascending (if available)
                # Note: Calibre doesn't track download counts by default, fallback to timestamp
                query = query.order_by(Books.timestamp.asc())
            elif sort == 'hotdesc':
                # Sort by download count descending (if available)
                # Note: Calibre doesn't track download counts by default, fallback to timestamp
                query = query.order_by(Books.timestamp.desc())
            else:
                # Default to newest first
                query = query.order_by(Books.timestamp.desc())
            
            # Get total count before pagination
            total_count = query.count()
            
            # Apply pagination
            offset = (page - 1) * per_page
            books = query.offset(offset).limit(per_page).all()
            
            # Transform to API format
            books_data = []
            for book in books:
                # Get all authors for this book
                authors = [author.name for author in book.authors]
                
                # Get tags for this book
                tags = [tag.name for tag in book.tags]
                
                # Get languages for this book
                languages = [lang.lang_code for lang in book.languages]
                
                # Get available formats with sizes
                formats = [data.format.upper() for data in book.data]
                file_sizes = {data.format.upper(): data.uncompressed_size for data in book.data}
                
                # Get rating (from ratings relationship)
                rating = None
                if book.ratings:
                    rating = book.ratings[0].rating / 2  # Convert from 0-10 to 0-5
                
                # Check if book has cover
                has_cover = os.path.exists(os.path.join(self.db_path.parent, book.path, 'cover.jpg'))
                
                # Get publishers for this book
                publishers = [publisher.name for publisher in book.publishers]
                
                book_data = {
                    'id': book.id,
                    'title': book.title,
                    'authors': authors,
                    'series': book.series[0].name if book.series else None,
                    'series_index': float(book.series_index) if book.series_index else None,
                    'rating': rating,
                    'pubdate': book.pubdate.isoformat() if book.pubdate else None,
                    'timestamp': book.timestamp.isoformat() if book.timestamp else None,
                    'last_modified': book.last_modified.isoformat() if book.last_modified else None,
                    'tags': tags,
                    'languages': languages,
                    'formats': formats,
                    'path': book.path,
                    'has_cover': has_cover,
                    'comments': book.comments[0].text if book.comments else None,
                    'isbn': book.isbn if book.isbn else None,
                    'uuid': book.uuid if book.uuid else None,
                    'publishers': publishers,
                    'file_sizes': file_sizes
                }
                books_data.append(book_data)
            
            return {
                'books': books_data,
                'total': total_count,
                'page': page,
                'per_page': per_page,
                'pages': (total_count + per_page - 1) // per_page
            }
            
        except Exception as e:
            logger.error(f"Error querying Calibre database: {e}")
            raise
        finally:
            self.close_session(session)
    
    def get_book_details(self, book_id: int) -> Optional[Dict[str, Any]]:
        """Get detailed information for a specific book"""
        session = self.get_session()
        try:
            book = session.query(Books).filter(Books.id == book_id).first()
            if not book:
                return None
            
            # Get all related data
            authors = [{'id': author.id, 'name': author.name} for author in book.authors]
            series_info = None
            if book.series:
                series_info = {
                    'id': book.series[0].id,
                    'name': book.series[0].name,
                    'index': float(book.series_index) if book.series_index else None
                }
            
            tags = [{'id': tag.id, 'name': tag.name} for tag in book.tags]
            languages = [{'id': lang.id, 'code': lang.lang_code} for lang in book.languages]
            formats = [{'format': data.format.upper(), 'size': data.uncompressed_size} for data in book.data]
            
            # Get rating (from ratings relationship)
            rating = None
            if book.ratings:
                rating = book.ratings[0].rating / 2  # Convert from 0-10 to 0-5
            
            has_cover = os.path.exists(os.path.join(self.db_path.parent, book.path, 'cover.jpg'))
            
            return {
                'id': book.id,
                'title': book.title,
                'sort': book.sort,
                'authors': authors,
                'series': series_info,
                'rating': rating,
                'pubdate': book.pubdate.isoformat() if book.pubdate else None,
                'timestamp': book.timestamp.isoformat() if book.timestamp else None,
                'last_modified': book.last_modified.isoformat() if book.last_modified else None,
                'tags': tags,
                'languages': languages,
                'formats': formats,
                'path': book.path,
                'has_cover': has_cover,
                'comments': book.comments[0].text if book.comments else None,
                'isbn': book.isbn,
                'uuid': book.uuid
            }
            
        except Exception as e:
            logger.error(f"Error getting book details: {e}")
            raise
        finally:
            self.close_session(session)
    
    def get_authors(self) -> List[Dict[str, Any]]:
        """Get all authors"""
        session = self.get_session()
        try:
            authors = session.query(Authors).order_by(Authors.sort).all()
            return [{'id': author.id, 'name': author.name, 'sort': author.sort} for author in authors]
        finally:
            self.close_session(session)
    
    def get_series(self) -> List[Dict[str, Any]]:
        """Get all series"""
        session = self.get_session()
        try:
            series = session.query(Series).order_by(Series.sort).all()
            return [{'id': s.id, 'name': s.name, 'sort': s.sort} for s in series]
        finally:
            self.close_session(session)
    
    def get_tags(self) -> List[Dict[str, Any]]:
        """Get all tags"""
        session = self.get_session()
        try:
            tags = session.query(Tags).order_by(Tags.name).all()
            return [{'id': tag.id, 'name': tag.name} for tag in tags]
        finally:
            self.close_session(session)
    
    def get_library_stats(self) -> Dict[str, int]:
        """Get library statistics"""
        session = self.get_session()
        try:
            stats = {
                'total_books': session.query(Books).count(),
                'total_authors': session.query(Authors).count(),
                'total_series': session.query(Series).count(),
                'total_tags': session.query(Tags).count()
            }
            return stats
        finally:
            self.close_session(session)
    
    def find_duplicates(self) -> Dict[str, Any]:
        """Find potential duplicate books using multiple criteria"""
        session = self.get_session()
        try:
            duplicates = {
                'by_isbn': [],
                'by_title_author': [],
                'by_file_hash': []  # Future: could implement file hash comparison
            }
            
            # Find duplicates by ISBN
            isbn_duplicates = session.query(Books.isbn, func.count(Books.id).label('count'))\
                .filter(Books.isbn != '')\
                .filter(Books.isbn.isnot(None))\
                .group_by(Books.isbn)\
                .having(func.count(Books.id) > 1)\
                .all()
            
            for isbn, count in isbn_duplicates:
                books = session.query(Books).filter(Books.isbn == isbn).all()
                duplicate_group = []
                for book in books:
                    authors = [author.name for author in book.authors]
                    duplicate_group.append({
                        'id': book.id,
                        'title': book.title,
                        'authors': authors,
                        'isbn': book.isbn,
                        'path': book.path,
                        'timestamp': book.timestamp.isoformat() if book.timestamp else None,
                        'formats': [data.format.upper() for data in book.data],
                        'file_size': sum(data.uncompressed_size or 0 for data in book.data)
                    })
                duplicates['by_isbn'].append({
                    'isbn': isbn,
                    'count': count,
                    'books': duplicate_group
                })
            
            # Find duplicates by title + sanitized primary author
            # Get all books with their authors for processing
            all_books = session.query(Books).all()
            
            # Group books by sanitized title + primary author
            title_author_groups = {}
            for book in all_books:
                if not book.authors:
                    continue
                
                # Use first author as primary author and sanitize it
                primary_author = sanitize_author_name(book.authors[0].name)
                title = book.title.strip()
                key = f"{title}|||{primary_author}".lower()  # Use ||| as separator to avoid conflicts
                
                if key not in title_author_groups:
                    title_author_groups[key] = {
                        'title': title,
                        'author': primary_author,
                        'original_author': book.authors[0].name,  # Keep original for display
                        'books': []
                    }
                
                authors = [author.name for author in book.authors]
                title_author_groups[key]['books'].append({
                    'id': book.id,
                    'title': book.title,
                    'authors': authors,
                    'path': book.path,
                    'timestamp': book.timestamp.isoformat() if book.timestamp else None,
                    'formats': [data.format.upper() for data in book.data],
                    'file_size': sum(data.uncompressed_size or 0 for data in book.data)
                })
            
            # Only keep groups with more than one book
            for key, group in title_author_groups.items():
                if len(group['books']) > 1:
                    duplicates['by_title_author'].append({
                        'title': group['title'],
                        'author': group['author'],  # Sanitized author
                        'count': len(group['books']),
                        'books': group['books']
                    })
            
            # Summary statistics
            total_duplicate_books = sum(
                sum(group['count'] for group in duplicates[category])
                for category in duplicates
                if category != 'by_file_hash'
            )
            
            return {
                'duplicates': duplicates,
                'summary': {
                    'total_duplicate_groups': sum(len(duplicates[cat]) for cat in duplicates),
                    'total_duplicate_books': total_duplicate_books,
                    'by_category': {
                        'isbn': len(duplicates['by_isbn']),
                        'title_author': len(duplicates['by_title_author'])
                    }
                }
            }
            
        except Exception as e:
            logger.error(f"Error finding duplicates: {e}")
            raise
        finally:
            self.close_session(session)
    
    def delete_book(self, book_id: int) -> tuple[bool, str]:
        """Delete a book and all its related data from both database and filesystem"""
        session = self.get_session()
        try:
            book = session.query(Books).filter(Books.id == book_id).first()
            if not book:
                return False, f"Book {book_id} not found"
            
            book_title = book.title
            book_path = book.path
            
            # First, try to delete files from filesystem
            filesystem_error = None
            if book_path:
                try:
                    full_book_path = self.db_path.parent / book_path
                    if full_book_path.exists() and full_book_path.is_dir():
                        import shutil
                        shutil.rmtree(full_book_path)
                        logger.info(f"Deleted book files at: {full_book_path}")
                        
                        # Also try to remove empty author directory
                        author_path = full_book_path.parent
                        if author_path.exists() and author_path.is_dir():
                            try:
                                if not any(author_path.iterdir()):  # Check if directory is empty
                                    author_path.rmdir()
                                    logger.info(f"Removed empty author directory: {author_path}")
                            except OSError:
                                pass  # Directory not empty or other issue, ignore
                    else:
                        filesystem_error = f"Book files not found at path: {book_path}"
                        logger.warning(filesystem_error)
                except Exception as e:
                    filesystem_error = f"Failed to delete book files: {str(e)}"
                    logger.error(filesystem_error)
            
            # Delete from database regardless of filesystem result
            # Delete all related data first (in proper order to avoid foreign key constraints)
            
            # Delete from tables with direct foreign keys to books
            session.query(Identifiers).filter(Identifiers.book == book_id).delete()
            session.query(Data).filter(Data.book == book_id).delete()
            session.query(Comments).filter(Comments.book == book_id).delete()
            
            # Delete from many-to-many association tables
            # SQLAlchemy should handle these automatically, but let's be explicit for safety
            session.execute(books_authors_link.delete().where(books_authors_link.c.book == book_id))
            session.execute(books_tags_link.delete().where(books_tags_link.c.book == book_id))
            session.execute(books_series_link.delete().where(books_series_link.c.book == book_id))
            session.execute(books_ratings_link.delete().where(books_ratings_link.c.book == book_id))
            session.execute(books_languages_link.delete().where(books_languages_link.c.book == book_id))
            session.execute(books_publishers_link.delete().where(books_publishers_link.c.book == book_id))
            
            # Finally delete the book itself
            session.delete(book)
            session.commit()
            
            success_message = f"Book '{book_title}' (ID: {book_id}) deleted from database"
            if filesystem_error:
                success_message += f", but filesystem deletion failed: {filesystem_error}"
            
            logger.info(success_message)
            return True, success_message
            
        except Exception as e:
            session.rollback()
            error_message = f"Error deleting book {book_id}: {e}"
            logger.error(error_message)
            return False, error_message
        finally:
            self.close_session(session)
    
    def bulk_delete_books(self, book_ids: List[int]) -> Dict[str, Any]:
        """Delete multiple books in bulk"""
        session = self.get_session()
        try:
            deleted_books = []
            failed_books = []
            
            for book_id in book_ids:
                try:
                    book = session.query(Books).filter(Books.id == book_id).first()
                    if book:
                        title = book.title
                        
                        # Delete all related data first (in proper order)
                        session.query(Identifiers).filter(Identifiers.book == book_id).delete()
                        session.query(Data).filter(Data.book == book_id).delete()
                        session.query(Comments).filter(Comments.book == book_id).delete()
                        
                        # Delete from association tables
                        session.execute(books_authors_link.delete().where(books_authors_link.c.book == book_id))
                        session.execute(books_tags_link.delete().where(books_tags_link.c.book == book_id))
                        session.execute(books_series_link.delete().where(books_series_link.c.book == book_id))
                        session.execute(books_ratings_link.delete().where(books_ratings_link.c.book == book_id))
                        session.execute(books_languages_link.delete().where(books_languages_link.c.book == book_id))
                        session.execute(books_publishers_link.delete().where(books_publishers_link.c.book == book_id))
                        
                        # Delete the book
                        session.delete(book)
                        deleted_books.append({'id': book_id, 'title': title})
                    else:
                        failed_books.append({'id': book_id, 'error': 'Book not found'})
                        
                except Exception as e:
                    failed_books.append({'id': book_id, 'error': str(e)})
            
            session.commit()
            
            result = {
                'deleted_count': len(deleted_books),
                'failed_count': len(failed_books),
                'deleted_books': deleted_books,
                'failed_books': failed_books
            }
            
            logger.info(f"Bulk delete completed: {len(deleted_books)} deleted, {len(failed_books)} failed")
            return result
            
        except Exception as e:
            session.rollback()
            logger.error(f"Error in bulk delete: {e}")
            raise
        finally:
            self.close_session(session)
    
    def get_book_formats(self, book_id: int) -> List[str]:
        """Get available formats for a specific book"""
        session = self.get_session()
        try:
            formats = session.query(Data.format).filter(Data.book == book_id).all()
            return [format_tuple[0].upper() for format_tuple in formats]
        except Exception as e:
            logger.error(f"Error fetching formats for book {book_id}: {e}")
            return []
        finally:
            self.close_session(session)
    
    def get_book_cover(self, book_id: int) -> Optional[bytes]:
        """Get book cover image data from the Calibre library"""
        session = self.get_session()
        try:
            # Get the book to check if it has a cover
            book = session.query(Books).filter(Books.id == book_id).first()
            if not book or not book.has_cover:
                return None
            
            # Calibre stores covers as cover.jpg in the book's directory
            # The book path is stored relative to the library root
            library_root = self.db_path.parent  # metadata.db is in the library root
            book_path = library_root / book.path
            cover_path = book_path / "cover.jpg"
            
            if cover_path.exists():
                with open(cover_path, 'rb') as f:
                    return f.read()
            else:
                logger.warning(f"Cover file not found for book {book_id}: {cover_path}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching cover for book {book_id}: {e}")
            return None
        finally:
            self.close_session(session)

# Global instance
_calibre_db_manager = None

def get_calibre_db_manager(metadata_db_path: str = None) -> CalibreDBManager:
    """Get or create the global Calibre DB manager instance"""
    global _calibre_db_manager
    
    if _calibre_db_manager is None and metadata_db_path:
        _calibre_db_manager = CalibreDBManager(metadata_db_path)
    
    return _calibre_db_manager