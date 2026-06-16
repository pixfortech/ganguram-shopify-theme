if ( typeof PickupAvailabilityCompact !== 'function' ) {

  class PickupAvailabilityCompact extends HTMLElement {

    constructor(){

      super();
      this.classList.add('active');

      this.storeSelector = document.querySelector('store-selector[data-main-selector]');
      if ( this.storeSelector ) {
        const STORE_CHANGED_EVENT = () => {
          this.fetchAvailability(this.dataset.variantId, true);
        }
        this.storeSelector.addEventListener('storechanged', STORE_CHANGED_EVENT);
				const observer = new MutationObserver(()=>{
          this.storeSelector.removeEventListener('storechanged', STORE_CHANGED_EVENT);
					observer.disconnect();
				});
				observer.observe(this.parentElement, {
					attributes: false, childList: true, subtree: false
				});
      }

      if ( this.hasAttribute('data-static') ) {
        this.fetchAvailability(this.dataset.variantId);
      } else {
        const widgetIntersection = (entries, observer) => {
          if (!entries[0].isIntersecting) return;
          observer.unobserve(this);
          this.fetchAvailability(this.dataset.variantId);
        }
        new IntersectionObserver(widgetIntersection.bind(this), {rootMargin: '0px 0px 50px 0px'}).observe(this);
      }
      
    }

    fetchAvailability(variantId, forceFetch = false) {

      const pickupAvailabilityData = this.querySelector('[data-js-pickup-availability-data]');

      if ( pickupAvailabilityData && ! forceFetch ) {
        this.renderPreview(pickupAvailabilityData);
      } else {

        const variantSectionUrl = `${this.dataset.baseUrl.endsWith('/')?this.dataset.baseUrl:`${this.dataset.baseUrl}/`}variants/${variantId}/?section_id=helper-pickup-availability-compact`;

        fetch(variantSectionUrl)
          .then(response => response.text())
          .then(text => {
            const sectionInnerHTML = new DOMParser()
              .parseFromString(text, 'text/html')
              .querySelector('.shopify-section');
            this.renderPreview(sectionInnerHTML);
          })
          .catch(e => {
            console.log(e);
          });

      }

    }
    
    renderPreview(sectionInnerHTML) {
      
      const selectedStore = localStorage.getItem('selected-store');

      if ( this.storeSelector && selectedStore && this.storeSelector.storesList[selectedStore] ) {
        // search based on selected store 
        let storeFound = false;
        if ( selectedStore ) {
          sectionInnerHTML.querySelectorAll('.pickup-availability-alert').forEach(elm=>{
            if ( selectedStore == elm.dataset.store ) {
              this.innerHTML = elm.innerHTML.replace('{{ store }}', this.storeSelector.storesList[selectedStore]);
              storeFound = true;
            }
          })
        }
        if ( !storeFound ) {
          this.innerHTML = sectionInnerHTML.querySelector('.pickup-availability-alert[data-default-unavailable]').innerHTML.replace('{{ store }}', this.storeSelector.storesList[selectedStore]);
          storeFound = true;
        }
        if ( !selectedStore || !storeFound ) {
          this.innerHTML = '';
        }
      } else {
        // search based on default store
        this.innerHTML = sectionInnerHTML.querySelector('.pickup-availability-alert[data-default-store]').innerHTML;
      }

    }
    
  }

  if ( typeof customElements.get('pickup-availability-compact') == 'undefined' ) {
    customElements.define('pickup-availability-compact', PickupAvailabilityCompact);
	}

}