if ( typeof AnnouncementBar !== 'function' ) {

  class AnnouncementBar extends HTMLElement {

    constructor() {
      super();

      this._prefix = window.KT_PREFIX || '';

      this.slider = this.querySelector('[data-js-slider]');
      this.content = this.querySelectorAll(`.${this._prefix}announcement`);
      this.nextButton = this.querySelector(`.${this._prefix}announcement-bar__content-nav--right`);
      this.prevButton = this.querySelector(`.${this._prefix}announcement-bar__content-nav--left`);

      this.index = 0;
      this.length = this.content.length;

      this.autoplayEnabled = this.dataset.autoplay === 'true';
      this.autoplayIntervalDelay = this.dataset.autoplayInterval
        ? parseInt(this.dataset.autoplayInterval, 10)
        : 5000;

      this._autoplayInterval = null;

      if ( this.nextButton ) {
        this.nextButton.addEventListener('click', () => {
          this.stopAutoplay();
          this.changeSlide('next');
        });
      }

      if ( this.prevButton ) {
        this.prevButton.addEventListener('click', () => {
          this.stopAutoplay();
          this.changeSlide('prev');
        });
      }

      if ( this.autoplayEnabled && this.length > 1 ) {
        this.startAutoplay();
      }
    }

    startAutoplay() {
      this.stopAutoplay();

      const tick = () => {
        if ( this.index < this.length - 1 ) {
          this.changeSlide('next');
        } else {
          // loop from last → first
          this.index = -1;
          this.changeSlide('next');
        }
      };

      this._autoplayInterval = setInterval(tick, this.autoplayIntervalDelay);
    }

    stopAutoplay() {
      if ( this._autoplayInterval ) {
        clearInterval(this._autoplayInterval);
        this._autoplayInterval = null;
      }
    }

    changeSlide(direction) {
      if (!this.slider || !this.length) return;

      this.nextButton?.classList.remove(`${this._prefix}announcement-bar__content-nav--disabled`);
      this.prevButton?.classList.remove(`${this._prefix}announcement-bar__content-nav--disabled`);

      if ( direction === 'next' ) {
        this.index++;
      } else if ( direction === 'prev' ) {
        this.index--;
      }

      if ( this.index < 0 ) this.index = 0;
      if ( this.index > this.length - 1 ) this.index = this.length - 1;

      if ( this.index === this.length - 1 ) {
        this.nextButton?.classList.add(`${this._prefix}announcement-bar__content-nav--disabled`);
      }
      if ( this.index === 0 ) {
        this.prevButton?.classList.add(`${this._prefix}announcement-bar__content-nav--disabled`);
      }

      this.slider.scrollTo({
        top: 0,
        left: this.content[this.index].offsetLeft,
        behavior: 'smooth'
      });
    }

  }

  if ( typeof customElements.get('announcement-bar') === 'undefined' ) {
    customElements.define('announcement-bar', AnnouncementBar);
  }

}