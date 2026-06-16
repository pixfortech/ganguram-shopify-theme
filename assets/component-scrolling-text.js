if (typeof ScrollingText !== "function") {
  class ScrollingText extends HTMLElement {

    constructor() {
      super();
    }
    
    connectedCallback() {
      requestAnimationFrame(() => this.init());
    }

    disconnectedCallback() {
      this.stop();
      if (this._intersectionObserver) this._intersectionObserver.disconnect();
      if (this._resizeObserver) this._resizeObserver.disconnect();
      window.removeEventListener("blur", this._onBlur);
      window.removeEventListener("focus", this._onFocus);

      this.removeEventListener("mouseover", this._onMouseOver);
      this.removeEventListener("mouseout", this._onMouseOut);
    }

    init() {

      this._running = false;
      this._position = 0;

      this._speed = window.innerWidth > 768
        ? parseFloat(this.dataset.scrollingSpeed)
        : parseFloat(this.dataset.scrollingSpeed) / 1.5;

      this._direction = this.dataset.scrollingDirection || "ltr";
      this._pauseOnHover = this.dataset.pauseOnHover === "true";
      this._hoverEaseDuration = this.dataset.pauseOnHoverEase === "true" ? 1 : 0;

      this._lastTime = null;
      this._velocityMultiplier = 1;
      this._targetMultiplier = 1;

      this._loop = this._loop.bind(this);
      this._onMouseOver = this._onMouseOver.bind(this);
      this._onMouseOut = this._onMouseOut.bind(this);
      this._onResize = this._onResize.bind(this);

      this._base = this.children[0];
      if (!this._base) return;

      this._base.style.position = "relative";

      for (const child of this.children) {
        child.style.willChange = "transform";
        child.style.transform = "translate3d(0,0,0)";
      }

      this._template = this._base.cloneNode(true);

      this._readSizes();
      this._setupChildren();

      this._setupHoverPause();
      this._setupIntersectionObserver();
      this._setupResizeObserver();

      this.start();
    }

    _readSizes() {
      const rectBox = this.getBoundingClientRect();
      const rectChild = this._base.getBoundingClientRect();
      this._boxWidth = rectBox.width;
      this._itemWidth = rectChild.width;
    }

    _neededChildren() {
      return Math.ceil(this._boxWidth / this._itemWidth) + 1;
    }

    _setupChildren() {
      const needed = this._neededChildren();
      const current = this.children.length;

      if (needed > current) {
        for (let i = current; i < needed; i++) {
          const clone = this._template.cloneNode(true);
          clone.style.willChange = "transform";
          clone.style.transform = "translate3d(0,0,0)";
          this.appendChild(clone);
        }
      } else if (needed < current) {
        for (let i = current; i > needed; i--) {
          this.removeChild(this.lastElementChild);
        }
      }
    }

    start() {
      if (this._running) return;
      this._running = true;
      this._lastTime = null;
      requestAnimationFrame(this._loop);
    }

    stop() {
      this._running = false;
    }

    _loop(timestamp) {
      if (!this._running) return;

      if (!this._lastTime) this._lastTime = timestamp;
      const delta = timestamp - this._lastTime;
      this._lastTime = timestamp;

      if (this._velocityMultiplier !== this._targetMultiplier) {
        const easeDelta = delta / (this._hoverEaseDuration * 1000);
        if (this._targetMultiplier < this._velocityMultiplier) {
          this._velocityMultiplier = Math.max(this._targetMultiplier, this._velocityMultiplier - easeDelta);
        } else {
          this._velocityMultiplier = Math.min(this._targetMultiplier, this._velocityMultiplier + easeDelta);
        }
      }

      const p = this._position;
      const dir = this._direction;

      const transformValue = dir === "rtl"
        ? `translate3d(${p}px, 0, 0)`
        : `translate3d(${-p}px, 0, 0)`;

      for (const el of this.children) {
        el.style.transform = transformValue;
      }

      this._position += (this._speed * this._velocityMultiplier * delta) / 1000;
      if (this._position >= this._itemWidth) {
        this._position = this._position % this._itemWidth;
      }

      requestAnimationFrame(this._loop);
    }

    _setupHoverPause() {
      if (!this._pauseOnHover) return;

      this._windowInFocus = true;

      this._onBlur = () => (this._windowInFocus = false);
      this._onFocus = () => (this._windowInFocus = true);

      window.addEventListener("blur", this._onBlur);
      window.addEventListener("focus", this._onFocus);

      this.addEventListener("mouseover", this._onMouseOver);
      this.addEventListener("mouseout", this._onMouseOut);
    }

    _onMouseOver() {
      if (!this._windowInFocus) return;
      if (this._hoverEaseDuration > 0) {
        this._targetMultiplier = 0;
      } else {
        this.stop();
      }
    }

    _onMouseOut() {
      if (!this._windowInFocus) return;
      if (this._hoverEaseDuration > 0) {
        this._targetMultiplier = 1;
      } else {
        this.start();
      }
    }

    _setupIntersectionObserver() {
      this._intersectionObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) this.start();
        else this.stop();
      });
      this._intersectionObserver.observe(this);
    }

    _setupResizeObserver() {
      this._resizeObserver = new ResizeObserver(this._onResize);
      this._resizeObserver.observe(this);
    }

    _onResize() {
      if (!this._running) return;
      this._readSizes();
      this._setupChildren();
    }

  }

  if ( typeof customElements.get("scrolling-text") == 'undefined' ) {
    customElements.define("scrolling-text", ScrollingText);
  }


}