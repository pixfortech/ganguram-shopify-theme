if ( typeof CSSSlider !== 'function' ) {
  class CSSSlider extends HTMLElement {

    constructor(){

      super();

      this._prefix = window.KT_PREFIX || '';

      this._touchScreen = document.body.classList.contains('touchevents');

      this._rtl = document.documentElement.getAttribute('dir') == 'rtl';

      // create option object, from defaults
      this.o = {
        ...{
          domReady: false,
          selector: `.${this._prefix}css-slide`, 
          snapping: true, 
          groupCells: false,
          forceOneSlidePerPage: false,
          autoHeight: false, 
          navigation: true,
          navigationDOM: `<span class="${this._prefix}css-slider-button ${this._prefix}css-slider-prev" style="display:none">←</span>
            <span class="${this._prefix}css-slider-button ${this._prefix}css-slider-next" style="display:none">→</span>`,
          thumbnails: true,
          thumbnailsDOM: `<div class="${this._prefix}css-slider-dot-navigation" style="display:none"></div>`,
          thumbnailsNoInteraction: false,
          indexNav: false,
          indexNavDOM: `<div class="${this._prefix}css-slider-index-navigation"><span class="${this._prefix}css-slider-current">1</span> / <span class="${this._prefix}css-slider-total">1</span></div>`,
          watchCSS: false,
          undisplay: false,
          disableSwipe: false,
          listenScroll: false,
          observer: true,
          disableMouseDownEvent: true,
          disableTabNavigation: false,
          autoplay: 0,
          forceFirstSlide: false
        }, ...JSON.parse(this.dataset.options)
      };

      // init slider or watch for css
      if ( ! this.o.watchCSS ) {
        this.initSlider();
      } else {
        this.RESIZE_WATCHER = debounce(()=>{
          const afterContent = window.getComputedStyle(this,':after').content;
          if ( afterContent.includes('css-slide') && !this.sliderEnabled ) {
            this.initSlider();
          } else if ( !afterContent.includes('css-slide') && this.sliderEnabled )  { 
            this.destroySlider();
          }
        }, 100);
        window.addEventListener('resize', this.RESIZE_WATCHER);
        this.RESIZE_WATCHER();
      }

    }

    destroySlider(){
      this.innerHTML = `${this.originalHTML}`;
      this.classList.remove(`${this._prefix}enabled`);
      this.sliderEnabled = false;
      window.removeEventListener('resize', this.RESIZE_EVENT);
      window.removeEventListener('scroll', this.SCROLL_EVENT);
      this.element.removeEventListener('scroll', this.SCROLL_EVENT_ANIMATIONS);
      this.dispatchEvent(new CustomEvent('destroy'));
    }

    initSlider(){

      // create custom events

      this._readyEvent = new CustomEvent('ready');
      this._changeEvent = new CustomEvent('change');
      this._scrollEvent = new CustomEvent('scroll');
      this._navEvent = new CustomEvent('navigation');
      this._resetEvent = new CustomEvent('reset');
      this._pointerDownEvent = new CustomEvent('pointerDown');
      this._pointerUpEvent = new CustomEvent('pointerUp');

      // create slider structure

      this.classList.add(`${this._prefix}css-slider`);
      if ( ! this.o.domReady ) {
        this.originalHTML = this.innerHTML;
        this.innerHTML = `<div class="${this._prefix}css-slider-viewport">
          <div class="${this._prefix}css-slider-holder" ${this.o.disableTabNavigation ? 'tabindex="-1"' : ''}>
            <div class="${this._prefix}css-slider-container">
              ${this.originalHTML}
            </div>
          </div>
        </div>`;
      }

      // add css-slide to children, if it's not set
      if ( this.o.undisplay ) {
        this.querySelectorAll(`${this.o.selector}`).forEach((elm)=>{
          elm.style.display = 'block';
        })
      }

      if ( this.o.selector != `.${this._prefix}css-slide` ) {
        this.querySelectorAll(`${this.o.selector}`).forEach((elm)=>{
          elm.classList.add(`${this._prefix}css-slide`);
        })
      }

      // setup variables

      this.element = this.querySelector(`.${this._prefix}css-slider-holder`);
      if ( this.o.groupCells ) {
        this.element.scrollLeft = 0;
      }

      this.items = this.querySelectorAll(`${this.o.selector}`);
      this.indexedItems = [];
      this.index = 0;
      this.length = this.items.length;
      this.windowWidth = window.innerWidth;
      this._forcedSlideChange = false;

      if ( this.o.disableMouseDownEvent ) {
        this.querySelector(`.${this._prefix}css-slider-container`).addEventListener('mousedown', e=>{
          if ( e.target.tagName !== 'SELECT' ) {
            e.preventDefault();
          }
        })
      }
      
      this.viewport = this.querySelector(`.${this._prefix}css-slider-viewport`);
      if ( this.o.autoHeight ) {
        this.viewport.classList.add('auto-height');
      }

      // append navigation

      if ( this.o.navigation || this.o.thumbnails || this.indexNav ) {

        const navigationElements = new DOMParser().parseFromString(this.o.navigationDOM, 'text/html');
        let container = document.createElement('div');
        container.classList.add(`${this._prefix}css-slider-navigation-container`);
        container.innerHTML = `
          ${(this.o.navigation ? navigationElements.querySelector(`.${this._prefix}css-slider-prev`).outerHTML : '')}
          ${(this.o.thumbnails ? this.o.thumbnailsDOM : '')}
          ${(this.o.navigation ? navigationElements.querySelector(`.${this._prefix}css-slider-next`).outerHTML : '')}
          ${(this.o.indexNav ? this.o.indexNavDOM : '')}`;

        if ( this.o.navigation ) {

          this.prevEl = container.querySelector(`.${this._prefix}css-slider-prev`);
          this.prevEl.setAttribute('tabindex', 0);
          this.prevEl.setAttribute('role', 'button');
          this.prevEl.addEventListener('click', e=>{
            e.preventDefault();
            this.changeSlide('prev');
            this.dispatchEvent(this._navEvent);
          });
          this.prevEl.addEventListener('keydown', e=>{
				    if ( e.keyCode == window.KEYCODES.RETURN ) {
              this.prevEl.click();
            }
          });
          this.prevEl.querySelector('svg').setAttribute('aria-hidden', 'true');
          const prevElA11y = document.createElement('span');
          prevElA11y.textContent = window.KROWN.settings.locales.slider_prev_button_label;
          prevElA11y.classList.add(`${this._prefix}visually-hidden`);
          this.prevEl.appendChild(prevElA11y);

          this.nextEl = container.querySelector(`.${this._prefix}css-slider-next`);
          this.nextEl.setAttribute('tabindex', 0);
          this.nextEl.setAttribute('role', 'button');
          this.nextEl.addEventListener('click', e=>{
            e.preventDefault();
            this.changeSlide('next');
            this.dispatchEvent(this._navEvent);
          });
          this.nextEl.addEventListener('keydown', e=>{
				    if ( e.keyCode == window.KEYCODES.RETURN ) {
              this.nextEl.click();
            }
          });
          this.nextEl.querySelector('svg').setAttribute('aria-hidden', 'true');
          const nextElA11y = document.createElement('span');
          nextElA11y.textContent = window.KROWN.settings.locales.slider_next_button_label;
          nextElA11y.classList.add(`${this._prefix}visually-hidden`);
          this.nextEl.appendChild(nextElA11y);

        }

        if ( this.o.thumbnails ) {
          this.thumbnailsEl = container.querySelector(`.${this._prefix}css-slider-dot-navigation`); 
        }

        if ( this.o.indexNav ) {
          this.indexEl = container.querySelector(`.${this._prefix}css-slider-current`);
          this.lengthEl = container.querySelector(`.${this._prefix}css-slider-total`); 
        }

        this.append(container);

      }

      if ( this.length > 1 ) {

        // add observer
        
        if ( this.o.observer ) {

          this.OBSERVER = new IntersectionObserver(entries=>{
            if ( ! this._sliderBlockScroll ) {
              entries.forEach(entry=>{
                if ( entry.intersectionRatio >= .5 ) {
                  this.index = parseInt(entry.target.getAttribute('data-index'));
                  this.checkSlide();
                  this.dispatchEvent(this._changeEvent);
                }
              })
            }
          }, {
            threshold: [0, .5]
          }); 

        } else {

          this.SCROLL_EVENT = debounce(()=>{
            if ( ! this._sliderBlockScroll ) {
              const scrollItems = this.indexedItems.entries();
              const scrollArray = Array.from(scrollItems, elm => Math.abs(elm[1].offsetLeft-this.element.scrollLeft));
              const scrollDistance = Math.min(...scrollArray);
              const scrollIndex = scrollArray.indexOf(scrollDistance);
              if ( scrollIndex != this.index ) {
                this.index = scrollIndex;
                this.checkSlide();
                this.dispatchEvent(this._changeEvent);
              }
            }
          }, 10);

          this.element.addEventListener('scroll', this.SCROLL_EVENT, {passive:true});

        }

        // reset on resize

        this.RESIZE_EVENT = debounce(()=>{
          if ( this.windowWidth != window.innerWidth && this.o.groupCells) {
            this.resetSlider();
          }
          if ( ! this.o.groupCells ) {
            this.checkSlide();
          }
          this.windowWidth = window.innerWidth;
        }, 100);
        window.addEventListener('resize', this.RESIZE_EVENT);
        this.resetSlider(true);    

        // dispatching scroll event, mostly for extra animations
        if ( this.o.listenScroll ) {
          this.SCROLL_EVENT_ANIMATIONS = (()=>{
            let slidesWidth = -this.querySelector(`.${this._prefix}css-slider-container`).offsetWidth;
            this.items.forEach(elm=>{slidesWidth += elm.offsetWidth});
            this.progress = this.element.scrollLeft / slidesWidth;
            this.dispatchEvent(this._scrollEvent);
          });
          this.element.addEventListener('scroll', this.SCROLL_EVENT_ANIMATIONS, {passive:true});
        }

        if ( ! this.o.disableSwipe && ! this._touchScreen && ! this.element.classList.contains(`${this._prefix}css-slider--singular`) ) {
          this.element.addEventListener('mousedown', e=>{
            if ( ! this.element.classList.contains(`${this._prefix}css-slider--disable-dragging`) ) {
              this.mouseX = e.screenX;
              this.element.classList.add(`${this._prefix}can-drag`);
              this.element.classList.add(`${this._prefix}mouse-down`);
            }
          });
          this.element.addEventListener('mouseup', e=>{
            this.element.classList.remove(`${this._prefix}mouse-down`);
            this.element.classList.remove(`${this._prefix}can-drag`);
            this.element.classList.remove(`${this._prefix}pointer-events-off`);
            if ( this._pot ) clearTimeout(this._pot);
          });

          this.element.addEventListener('mouseleave', e=>{
            this.element.classList.remove(`${this._prefix}mouse-down`);
            this.element.classList.remove(`${this._prefix}can-drag`);
            this.element.classList.remove(`${this._prefix}pointer-events-off`);
            if ( this._pot ) clearTimeout(this._pot);
          });

          this.element.addEventListener('mousemove', e=>{
            if ( this.element.classList.contains(`${this._prefix}can-drag`) ) {
              let directionX = this.mouseX - e.screenX;
              if ( Math.abs(directionX) > 1 ) {
                if ( ! this.element.classList.contains(`${this._prefix}css-slider--no-drag`) ) {
                  this.element.classList.add(`${this._prefix}pointer-events-off`);
                }
                if ( ( ! this._rtl && directionX > 0 ) || ( this._rtl && directionX < 0 ) ) {
                  this.changeSlide('next');
                  this.element.classList.remove(`${this._prefix}can-drag`);
                } else if ( ( ! this._rtl && directionX < 0 ) || ( this._rtl && directionX > 0 ) ) {
                  this.changeSlide('prev');
                  this.element.classList.remove(`${this._prefix}can-drag`);
                }
              }
            }
          });

        }

        // helper for browser that don't support smooth scrolling

        if ( ! ( "scrollBehavior" in document.documentElement.style ) && ! this._touchScreen ) {
          this.element.classList.add(`${this._prefix}force-disable-snapping`);
        }

        if ( ! this._touchScreen ) {
          this.element.ondragstart = e => {
            e.preventDefault();      
          }
        }

      }

      // dispatch ready event

      this.classList.add(`${this._prefix}enabled`);
      this.sliderEnabled = true;
      this.dispatchEvent(this._readyEvent);

      // check for autoplay

      if ( parseInt(this.o.autoplay) > 0 ) {
        this._initAutoplay();
      }

      // force slide change
      if ( this.o.forceFirstSlide && this._forcedSlideChange === false ) {
        this._forcedSlideChange = true;
        setTimeout(()=>{
          this.changeSlide(0);
        }, 10);
      }

    }

    changeSlide(direction, behavior='smooth'){

      // function that changes the slide, either by word (next/prev) or index

      if ( direction == 'next' ) {
        if ( this.index+1 < this.length ) {
          this.index++;
        }
      } else if ( direction == 'prev') {
        if ( this.index-1 >= 0 ) {
          this.index--;
        }
      } else if ( parseInt(direction) >= 0 ) {
        this.index = parseInt(direction);
      }
      

      this._sliderBlockScroll = true;
      setTimeout(()=>{
        this._sliderBlockScroll = false;
      }, 500);  
      
      let left = 0;
      if ( this.index > 0 ) {
        if ( this._rtl && this.slidesPerPage > 1) {
          left = ((this.o.sliderWidthSelector ? document.querySelector(this.o.sliderWidthSelector).offsetWidth : this.querySelector(`.${this._prefix}css-slider-container`).offsetWidth) - (this.indexedItems[this.index].offsetLeft - parseInt(getComputedStyle(this.indexedItems[0]).marginLeft))) * -1;
        } else {
          left = this.indexedItems[this.index].offsetLeft - parseInt(getComputedStyle(this.indexedItems[0]).marginLeft)
        }
      }
      
      this.checkSlide();
      this.element.scrollTo({
        top: 0,
        left: left,
        behavior: behavior
      });
      this.dispatchEvent(this._changeEvent);

    }

    checkSlide(){  
      
      // checks slide after index change and updates navigation / viewport

      if ( this.o.navigation ) {
        this.prevEl.classList.remove(`${this._prefix}disabled`);
        this.nextEl.classList.remove(`${this._prefix}disabled`);
        if ( this.index == 0 ) {
          this.prevEl.classList.add(`${this._prefix}disabled`);
        }
        if ( this.index == this.length - 1 ) {
          this.nextEl.classList.add(`${this._prefix}disabled`);
        }
      }

      if ( this.o.thumbnails && this.thumbnails ) {
        this.thumbnails.forEach(elm=>{elm.classList.remove(`${this._prefix}active`)});
        this.thumbnails[this.index].classList.add(`${this._prefix}active`);
      }

      if ( this.o.indexNav ) {
        this.indexEl.textContent = this.index+1;
      }
      
      if ( this.o.autoHeight ) {
        this.viewport.style.height = this.indexedItems[this.index].offsetHeight + 'px';
      } 
      
      this.indexedItems.forEach((elm,i)=>{
        if ( i == this.index ) {
          elm.classList.add(`${this._prefix}css-slide-active`);
        } else {
          elm.classList.remove(`${this._prefix}css-slide-active`);
        }
      });

      if ( ! this.o.disableTabNavigation ) {
        const maxStart = Math.max(0, this.items.length - this.slidesPerPage); 
        const start = this.index * this.slidesPerPage;
        const adjustedStart = Math.min(start, maxStart);
        const end = adjustedStart + this.slidesPerPage;
        this.items.forEach((elm) => {
          elm.setAttribute('inert', '');
        });
        for ( let i = adjustedStart; i < end && i < this.items.length; i++ ) {
          const elm = this.items[i];
          elm.removeAttribute('inert');
        }
      } 

      if ( parseInt(this.o.autoplay) > 0 ) {
        this._initAutoplay();
      }

    }

    afterAppend(){
      this.items = this.querySelectorAll(`${this.o.selector}`);
    }

    _initAutoplay(){
      if ( this._autoplayInterval ) {
        clearInterval(this._autoplayInterval);
      }
      this._autoplayInterval = setInterval(()=>{
        if ( this.index + 1 == this.length ) {
          this.changeSlide(0);
        } else {
          this.changeSlide('next');
        }
      }, parseInt(this.o.autoplay));
      this.classList.remove(`${this._prefix}autoplay-running`);
      this.offsetWidth;
      this.classList.add(`${this._prefix}autoplay-running`);
    }

    resetSlider(nojump=false,resetIndex=true){

      let slidesWidth = 0,
          page = 0,
          pages = 0,
          totalWidth = this.o.sliderWidthSelector ? document.querySelector(this.o.sliderWidthSelector).offsetWidth : this.querySelector(`.${this._prefix}css-slider-container`).offsetWidth,// - 20,
          hideNavigation = false;

      // reset entire slider

      this.slidesPerPage = 0;
      this.indexedItems = [];
      this.element.classList.add(`${this._prefix}disable-snapping`);
      if ( this.OBSERVER ) {
        this.OBSERVER.disconnect();
      }

      // find out how many pages (slides there are now)

      this.items.forEach((elm, i)=>{
        elm.classList.remove(`${this._prefix}css-slide--snap`);
        slidesWidth += elm.getBoundingClientRect().width;
        if ( slidesWidth > totalWidth && this.slidesPerPage == 0 ) {
          this.slidesPerPage = i;
        }
      }); 

      if ( this.slidesPerPage == 0 ) {
        this.slidesPerPage = this.items.length;
        hideNavigation = true;
      } 

      if ( this.o.forceOneSlidePerPage ) {
        this.slidesPerPage = 1;
      }

      const sliderDifference = totalWidth - slidesWidth;
      if ( sliderDifference < 60 ) {
        this.setAttribute('data-slides-per-page-difference', 'small')
      } else if ( sliderDifference >= 60 ) {
        this.setAttribute('data-slides-per-page-difference', 'large')
      }

      // set each slide for observer
      
      this.items.forEach((elm, i) => {
        if ( i % this.slidesPerPage == 0  ) {
          elm.classList.add(`${this._prefix}css-slide--snap`);
          elm.setAttribute('data-index', page++);
          if ( this.OBSERVER ) {
            this.OBSERVER.observe(elm);
          }
        }
      });

      this.indexedItems = this.querySelectorAll(`${this.o.selector}.${this._prefix}css-slide--snap`);
      if ( resetIndex ) {
        this.index = 0;
      }
      this.length = Math.ceil(this.items.length / this.slidesPerPage);

      // recreate navigation

      if ( this.o.thumbnails ) {
        this.thumbnailsEl.innerHTML = '';
        for ( let i = 0; i < this.length; i++ ) {
          let dot = document.createElement('span');
          dot.classList.add(`${this._prefix}css-slider-dot`);
          dot.dataset.index = i;
          this.thumbnailsEl.appendChild(dot);
          if ( ! this.o.thumbnailsNoInteraction ) {
            dot.addEventListener('click', (e)=>{
              this.changeSlide(e.target.dataset.index);
            });
            dot.setAttribute('aria-label', window.KROWN.settings.locales.slider_thumbnail_label.replace('{{ count }}', i+1));
            dot.setAttribute('role', 'button');
            dot.setAttribute('tabindex', 0);
            dot.addEventListener('keydown', e=>{
              if ( e.keyCode == window.KEYCODES.RETURN ) {
                dot.click();
              }
            });
          }
        }
        this.thumbnailsEl.style.setProperty('--size', this.length);
        this.thumbnails = this.thumbnailsEl.querySelectorAll(`.${this._prefix}css-slider-dot`);
      }

      if ( this.o.indexNav ) {
        this.indexEl.textContent = this.index+1;
        this.lengthEl.textContent = this.length;
      }

      // hide navigation if only one slide

      if ( hideNavigation ) {
        this.element.classList.add(`${this._prefix}css-slider--no-drag`);
        if ( this.o.navigation ) {
          this.prevEl.style.display = 'none';
          this.nextEl.style.display = 'none';
        }
        if ( this.o.thumbnails ) {
          this.thumbnailsEl.style.display = 'none';
        }
      } else {
        this.element.classList.remove(`${this._prefix}css-slider--no-drag`);
        if ( this.o.navigation ) {
          this.prevEl.style.display = 'block';
          this.nextEl.style.display = 'block';
        }
        if ( this.o.thumbnails ) {
          this.thumbnailsEl.style.display = 'block';
        }
      }

      this.checkSlide();

      if ( ! nojump ) {
        this.element.scrollTo({
          top: 0,
          left: 0,
          behavior: 'auto'
        })
      }
      this.element.classList.remove(`${this._prefix}disable-snapping`);
      this.setAttribute('data-slider-length', this.length);

      this.dispatchEvent(this._resetEvent);

    }

  }

  if ( typeof customElements.get('css-slider') == 'undefined' ) {
    customElements.define('css-slider', CSSSlider);
  }

  document.addEventListener('shopify:section:load', (e)=>{
    if ( e.target.classList.contains(`mount-css-slider`) && e.target.querySelector('css-slider') ) {
      e.target.querySelectorAll('css-slider').forEach(slider=>{if(slider.enabled)slider.resetSlider()});
    }
  });
  
}