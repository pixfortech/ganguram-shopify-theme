if (typeof ShareLink !== 'function') {
  class ShareLink extends HTMLElement {
    constructor() {
      super();
      this.init();
    }

    init() {

      const title = this.getAttribute('data-link-info');
      const url = this.getAttribute('data-link-url') || window.location.href;
      const copyText = this.getAttribute('data-link-text-copy') || 'Copy to clipboard';
      const copiedText = this.getAttribute('data-link-text-copied') || 'URL copied';
      const textElement = this.querySelector('.text-animation--underline-thin') || this.querySelector('[class*="social-share__text"]');

      if (!navigator.share) {
        if (textElement) {
          textElement.textContent = copyText;
        }

        this.addEventListener('click', (event) => {
          event.preventDefault();

          navigator.clipboard.writeText(url).then(() => {
            if (textElement) {
              textElement.textContent = copiedText;
              setTimeout(() => {
                textElement.textContent = copyText;
              }, 2000);
            }
          });
        });
      } else {
        this.addEventListener('click', async (event) => {
          event.preventDefault();
          try {
            await navigator.share({
              title: title,
              url: url,
            });
          } catch (error) {
          }
        });
      }
    }
  }

  if (typeof customElements.get('share-link') === 'undefined') {
    customElements.define('share-link', ShareLink);
  }
  
}