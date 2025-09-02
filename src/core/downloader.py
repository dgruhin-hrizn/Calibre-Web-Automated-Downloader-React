"""Network operations manager for the book downloader application."""

from ..infrastructure import network
network.init()
import requests
import time
from io import BytesIO
from typing import Optional
from urllib.parse import urlparse
from tqdm import tqdm
from typing import Callable
from threading import Event
from ..infrastructure.logger import setup_logger
from ..infrastructure.config import PROXIES
from ..infrastructure.env import MAX_RETRY, DEFAULT_SLEEP, USE_CF_BYPASS, USING_EXTERNAL_BYPASSER

# Setup logger before using it
logger = setup_logger(__name__)

if USE_CF_BYPASS:
    if USING_EXTERNAL_BYPASSER:
        from ..utils.cloudflare.external import get_bypassed_page
    else:
        from ..utils.cloudflare.bypasser import get_bypassed_page
        logger.info("Using SeleniumBase bypasser")


def html_get_page(url: str, retry: int = MAX_RETRY, use_bypasser: bool = False) -> str:
    """Fetch HTML content from a URL with retry mechanism.
    
    Args:
        url: Target URL
        retry: Number of retry attempts
        skip_404: Whether to skip 404 errors
        
    Returns:
        str: HTML content if successful, None otherwise
    """
    response = None
    try:
        # Clean the URL of any invisible characters, trailing commas, or whitespace
        clean_url = url.strip().rstrip(',').rstrip()
        # Remove any invisible Unicode characters that might be present
        clean_url = ''.join(char for char in clean_url if ord(char) < 127 or char.isprintable())
        
        if clean_url != url:
            logger.warning(f"URL cleaned: '{url}' -> '{clean_url}'")
        
        logger.debug(f"html_get_page: {clean_url}, retry: {retry}, use_bypasser: {use_bypasser}")
        if use_bypasser and USE_CF_BYPASS:
            logger.info(f"GET Using Cloudflare Bypasser for: {clean_url}")
            return get_bypassed_page(clean_url)
        else:
            logger.info(f"GET: {clean_url}")
            response = requests.get(clean_url, proxies=PROXIES)
            response.raise_for_status()
            logger.debug(f"Success getting: {clean_url}")
            time.sleep(1)
        return str(response.text)
        
    except Exception as e:
        if retry == 0:
            logger.error_trace(f"Failed to fetch page: {url}, error: {e}")
            return ""
        
        if use_bypasser and USE_CF_BYPASS:
            logger.warning(f"Exception while using cloudflare bypass for URL: {url}")
            logger.warning(f"Exception: {e}")
            logger.warning(f"Response: {response}")
        elif response is not None and response.status_code == 404:
            logger.warning(f"404 error for URL: {url}")
            return ""
        elif response is not None and response.status_code == 403:
            logger.warning(f"403 detected for URL: {url}. Should retry using cloudflare bypass.")
            return html_get_page(url, retry - 1, True)
            
        sleep_time = DEFAULT_SLEEP * (MAX_RETRY - retry + 1)
        logger.warning(
            f"Retrying GET {url} in {sleep_time} seconds due to error: {e}"
        )
        time.sleep(sleep_time)
        return html_get_page(url, retry - 1, use_bypasser)

def download_url(link: str, size: str = "", progress_callback: Optional[Callable[[float], None]] = None, cancel_flag: Optional[Event] = None) -> Optional[BytesIO]:
    """Download content from URL into a BytesIO buffer.
    
    Args:
        link: URL to download from
        
    Returns:
        BytesIO: Buffer containing downloaded content if successful
    """
    try:
        # Clean the download URL of any invisible characters or trailing commas
        clean_link = link.strip().rstrip(',').rstrip() if link else ""
        clean_link = ''.join(char for char in clean_link if ord(char) < 127 or char.isprintable())
        
        if clean_link != link:
            logger.debug(f"Download URL cleaned: '{link}' -> '{clean_link}'")
            link = clean_link
        
        logger.info(f"Downloading from: {link}")
        response = requests.get(link, stream=True, proxies=PROXIES)
        response.raise_for_status()

        total_size : float = 0.0
        try:
            # we assume size is in MB
            total_size = float(size.strip().replace(" ", "").replace(",", ".").upper()[:-2].strip()) * 1024 * 1024
        except:
            total_size = float(response.headers.get('content-length', 0))
        
        buffer = BytesIO()

        # Initialize the progress bar with your guess
        pbar = tqdm(total=total_size, unit='B', unit_scale=True, desc='Downloading')
        for chunk in response.iter_content(chunk_size=1000):
            buffer.write(chunk)
            pbar.update(len(chunk))
            if progress_callback is not None:
                progress_callback(pbar.n * 100.0 / total_size)
            if cancel_flag is not None and cancel_flag.is_set():
                logger.info(f"Download cancelled: {link}")
                return None
            
        pbar.close()
        if buffer.tell() * 0.1 < total_size * 0.9:
            # Check the content of the buffer if its HTML or binary
            if response.headers.get('content-type', '').startswith('text/html'):
                logger.warn(f"Failed to download content for {link}. Found HTML content instead.")
                return None
        return buffer
    except requests.exceptions.RequestException as e:
        logger.error_trace(f"Failed to download from {link}: {e}")
        return None

def get_absolute_url(base_url: str, url: str) -> str:
    """Get absolute URL from relative URL and base URL.
    
    Args:
        base_url: Base URL
        url: Relative URL
    """
    if url.strip() == "":
        return ""
    if url.strip("#") == "":
        return ""
    if url.startswith("http"):
        return url
    parsed_url = urlparse(url)
    parsed_base = urlparse(base_url)
    if parsed_url.netloc == "" or parsed_url.scheme == "":
        parsed_url = parsed_url._replace(netloc=parsed_base.netloc, scheme=parsed_base.scheme)
    return parsed_url.geturl()
