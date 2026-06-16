if ( typeof VideoComponent !== 'function' ) {

  class VideoComponent extends HTMLElement {

    constructor() {
      super();
      this._prefix = window.KT_PREFIX || '';
    }

    connectedCallback() {

      if ( ! this.observer ) {
        this.observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.onEnterViewport();
            } else {
              this.onExitViewport();
            }
          });
        }, {
          threshold: [0, 0.01, 0.25, 0.75, 1],
          rootMargin: '100px 0px 100px 0px'
        });

        this.observer.observe(this);

      }

      if ( this.querySelector('[data-js-video-component-link]') ) {
        this.querySelector('[data-js-video-component-link]').addEventListener('click', e => {
          e.preventDefault();
          this.loadVideoTemplate();
        });
      }

    }

    loadVideoTemplate() {
      
      const blackout = document.createElement('div');
      blackout.classList.add(`${this._prefix}video-component__blackout`);
      this.append(blackout);
      setTimeout(() => {
        blackout.style.opacity = '1';
      }, 10);

      this.classList.add(`${this._prefix}video-opened`);

      if ( this.querySelector('[data-js-video-component-close]') ) {
        this.querySelector('[data-js-video-component-close]').addEventListener('click', () => {
          this.querySelectorAll('iframe, video').forEach(elm => { elm.remove() });
          blackout.remove();
          this.classList.remove(`${this._prefix}video-opened`);
        });
      }

      this.querySelector('[data-js-video-component-container]').appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true));
     
      if ( this.dataset.autoplay !== 'true' ) { 
        setTimeout(() => {
          this._playMedia(this.closest('[data-video]'));
        }, 500);
      }

      if ( this.dataset.autoplay === 'true' ) {
        if ( this.querySelector('video') ) {
          this.querySelector('video').addEventListener('canplay', () => {
            this.classList.add(`${this._prefix}video-playing`);
          });
          if ( this.querySelector('video').readyState >= 3 ) {
            this.classList.add(`${this._prefix}video-playing`);
          }
        } else {
          this.classList.add(`${this._prefix}video-playing`);
        }
      }

    }

    onEnterViewport() {
      // Check if data-autoplay is true and if the popup is closed
      if ( this.dataset.autoplay === 'true' && !this.classList.contains(`${this._prefix}video-opened`) ) {
        // open the popup
        if ( this.querySelector('[data-js-video-component-link]') ) {
          this.loadVideoTemplate();
        }
      }

      // play video if in viewport and autoplay is true
      const media = this.closest('[data-video]');
      if ( media && this.dataset.autoplay === 'true' ) {
        this._playMedia(media);
      }

    }

    onExitViewport() {
      // pause video if outside the viewport
      const media = this.closest('[data-video]');
      if ( media ) {
        this._pauseMedia(media);
      }
    }

    _playMedia(media) {
      // triggers the PLAY function of each media type depending on it's source
      switch ( media.dataset.mediaType ) {
        case 'video':
          const video = media.querySelector('video');
          if ( video ) {
            video.play().catch(error => {
              this.classList.add(`${this._prefix}video-playing`);
            });
          }
          break;
        case 'youtube':
          const youtube = media.querySelector('.js-youtube');
          if ( youtube ) {
            youtube.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
          }
          break;
        case 'vimeo':
          const vimeo = media.querySelector('.js-vimeo');
          if ( vimeo ) {
            vimeo.contentWindow.postMessage('{"method":"play"}', '*');
          }
          break;
      }
    }

    _pauseMedia(media) {
      // triggers the PAUSE function of each media type depending on it's source
      switch ( media.dataset.mediaType ) {
        case 'video':
          const video = media.querySelector('video');
          if ( video ) {
            media.querySelector('video').pause();
          }
          break;
        case 'youtube':
          const youtube = media.querySelector('.js-youtube');
          if ( youtube ) {
            youtube.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
          }
          break;
        case 'vimeo':
          const vimeo = media.querySelector('.js-vimeo');
          if ( vimeo ) {
            vimeo.contentWindow.postMessage('{"method":"pause"}', '*');
          }
          break;
      }
    }

    disconnectedCallback() {
      if ( this.observer ) {
        this.observer.disconnect();
      }
      const videoContainer = this.closest('[data-video]');
      if ( videoContainer ) {
        this._pauseMedia(videoContainer);
      }
    }

  }

  if ( typeof customElements.get('video-component') == 'undefined' ) {
    customElements.define('video-component', VideoComponent);
  }

}