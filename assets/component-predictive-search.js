if ( typeof SearchForm !== 'function' ) {
	class SearchForm extends HTMLElement {

		constructor() {

			super();	
			this.cachedResults = {};
			this.input = this.querySelector('[data-js-search-input]');
			this.predictiveSearchResults = this.querySelector('[data-js-search-results]');
			this.results = [];
			this.preloader = false;
      this.a11yIndex = -1;
      this.requestVersion = 0;
      this.onDeliveryChange = () => this.filterDeliveryResults();

			if ( KROWN.settings.predictive_search_enabled != "false" ) {

				let inputValue = this.input.value;
				this.input.addEventListener('keyup', debounce(e=>{
					if ( this.input.value != inputValue ) {
						inputValue = this.input.value;
						this.getSearchResults(this.input.value.trim());
					} else if ( this.input.value == '' ) {
						this.clearSearchResults();
					}
				},150));

				this.input.addEventListener('keydown', e=>{
					if ( this.a11yIndex != -1 ) {
						if (
							e.keyCode === window.KEYCODES.UP ||
							e.keyCode === window.KEYCODES.DOWN ||
							e.keyCode === window.KEYCODES.RETURN
						) {
							e.preventDefault();
						}
					}
				});

				this.input.addEventListener('keyup', e=>{
					if (e.keyCode === window.KEYCODES.UP) {
						this.navigateThrough('UP');
						return true;
					}

					if (e.keyCode === window.KEYCODES.DOWN) {
						this.navigateThrough('DOWN');
						return true;
					}

					if (e.keyCode === window.KEYCODES.RETURN) {
						if ( this.a11yIndex != -1 ) {
							document.location.href = this.results[this.a11yIndex].tagName == "A" ? this.results[this.a11yIndex].href : this.results[this.a11yIndex].querySelector('a').href;
						}
					}
				})

			}

		}

    connectedCallback() { window.addEventListener('ganguram:delivery-location-changed', this.onDeliveryChange); }
    disconnectedCallback() { window.removeEventListener('ganguram:delivery-location-changed', this.onDeliveryChange); }

		getSearchResults(query="") {
      const version = ++this.requestVersion;
      if (!query) { this.clearSearchResults(); return; }

			this.preloadSearchResults();

			const queryKey = query.replace(" ", "-").toLowerCase();
			if (this.cachedResults[queryKey]) {
				this.renderSearchResults(this.cachedResults[queryKey]);
				return;
			}

			this.a11yIndex = -1;

			fetch(`${KROWN.settings.routes.predictive_search_url}?q=${encodeURIComponent(query)}&section_id=helper-predictive-search`)
				.then(response=>{
					if (!response.ok) {
						var error = new Error(response.status);
						this.clearSearchResults();
						throw error;
					}
					return response.text();
				})
				.then(text=>{
          if (version !== this.requestVersion) return;
					const results = new DOMParser().parseFromString(text, 'text/html').querySelector('#shopify-section-helper-predictive-search').innerHTML;
					this.cachedResults[queryKey] = results;
					this.renderSearchResults(results);
				})	
				.catch((e) => {
          if (version === this.requestVersion) this.clearSearchResults();
				}); 

		}

		clearSearchResults(){
      ++this.requestVersion;
      this.a11yIndex = -1;
			this.predictiveSearchResults.innerHTML = '';
			this.preloader = false;
			this.results = [];
		}

		preloadSearchResults(){
			if ( ! this.preloader ) {
				this.preloader = true;
				this.predictiveSearchResults.innerHTML = KROWN.settings.predictive_search_placeholder;
			}
		}

		renderSearchResults(results){
			// Filter detached markup before insertion: no flash of unavailable products.
      const fragment = document.createElement('div');
      fragment.innerHTML = results;
      this.filterDeliveryResults(fragment);
      this.predictiveSearchResults.innerHTML = fragment.innerHTML;
			this.preloader = false;
			this.filterDeliveryResults();
		}

    filterDeliveryResults(container = this.predictiveSearchResults) {
      const loc = window.GanguramZone?.getSelectedDeliveryLocation();
      const zone = loc?.isServiceable ? loc.zone : null;
      const rules = window.GanguramZoneRules;
      container.querySelectorAll('[data-ganguram-product-card]').forEach(card => {
        const allowed = !!rules && rules.cardAllowed(card, zone);
        card.hidden = !allowed;
        card.classList.toggle('ganguram-zone-hidden', !allowed);
      });
      if (container !== this.predictiveSearchResults) return;
      container.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
      this.a11yIndex = -1;
      this.results = Array.from(container.querySelectorAll('[data-js-search-item]')).filter(el => !el.hidden && !el.classList.contains('ganguram-zone-hidden'));
    }

		navigateThrough(direction){
      if (!this.results.length) { this.a11yIndex = -1; return; }

			if ( this.a11yIndex == -1 ) {
				this.a11yIndex = 0;
			} else {
				this.results[this.a11yIndex].classList.remove('active');
				if ( direction == 'UP' ) {
					if ( this.a11yIndex - 1 >= -1 ) {
						this.a11yIndex--;
					} 
				} else if ( direction == 'DOWN' ) {
					if ( this.a11yIndex + 1 < this.results.length ) {
						this.a11yIndex++;
					} 
				}
			}

			if ( this.a11yIndex >= 0 ) {
				this.results[this.a11yIndex].classList.add('active');
				this.predictiveSearchResults.querySelector('[data-js-search-results-holder]').scrollTop = this.results[this.a11yIndex].offsetTop - 200;
			} else {
				this.predictiveSearchResults.querySelector('[data-js-search-results-holder]').scrollTop = 0;
			}

		}

	}

  if ( typeof customElements.get('search-form') == 'undefined' ) {
		customElements.define('search-form', SearchForm);
	}

}