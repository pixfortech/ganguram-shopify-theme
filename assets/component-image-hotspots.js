if ( typeof ImageHotspots !== 'function' ) {

  class ImageHotspots extends HTMLElement {

    constructor(){
			
      super();

			this._prefix = window.KT_PREFIX || '';
			this._parentSelector = this.getAttribute('data-parent-selector') || '';
			if ( ! window.KT_HOTSPOTS_Z_INDEX ) {
				window.KT_HOTSPOTS_Z_INDEX = 10;
			}

      this.hotspots = this.querySelectorAll(
				`.${this._prefix}image-hotspots__spot--bullet`
			);

			this.hotspots.forEach((hotspot) => {
				hotspot.addEventListener('click', e => {
					document.querySelectorAll(`.${this._prefix}image-hotspots__spot--bullet.${this._prefix}active`).forEach(bullet => bullet.classList.remove(`${this._prefix}active`));
					if ( ! e.target.classList.contains(`${this._prefix}active`) ) {
						e.target.classList.toggle(`${this._prefix}active`);
						if ( this._parentSelector ) {
							e.target.closest(this._parentSelector).style.zIndex = window.KT_HOTSPOTS_Z_INDEX++;
						} else {
							e.target.parentNode.style.zIndex = window.KT_HOTSPOTS_Z_INDEX++;
						}
					}
					e.stopPropagation();
				});
			});

			if ( ! window.__KT_HOTSPOTS_DOCUMENT_CLICK_ATTACHED__ ) {
				document.addEventListener('click', () => {	
					const prefix = window.KT_PREFIX || '';
					document.querySelectorAll(`.${prefix}image-hotspots__spot--bullet.${prefix}active`).forEach(bullet => bullet.classList.remove(`${prefix}active`));
				});
				window.__KT_HOTSPOTS_DOCUMENT_CLICK_ATTACHED__ = true;
			}

    }

  }

  if ( typeof customElements.get('image-hotspots') == 'undefined' ) {
    customElements.define('image-hotspots', ImageHotspots);
  }

}

if ( Shopify.designMode ) {
	document.addEventListener('shopify:block:select', e => {
		let block = e.target;
		const prefix = window.KT_PREFIX || '';
		if ( block.closest(`.${prefix}image-hotspots__spot`) ) {
			block = block.closest(`.${prefix}image-hotspots__spot`);
		}
		if ( block.classList.contains(`${prefix}image-hotspots__spot`) ) {
			const bulletElements = document.querySelectorAll(`.${prefix}image-hotspots__spot--bullet`);
			bulletElements.forEach(bulletElement => bulletElement.classList.remove(`${prefix}active`));
			const activeBullet = block.querySelector(`.${prefix}image-hotspots__spot--bullet`);
      activeBullet.classList.add(`${prefix}active`);
    }
  });
}