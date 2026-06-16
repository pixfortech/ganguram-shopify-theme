if ( typeof ProductVariants !== 'function' ) {

	class ProductVariants extends HTMLElement {

		constructor() {

			super();
			this._cachedOptions = new Map(); // Map for cached options with LRU eviction
			this._loadingOptions = new Set(); // Options currently being loaded
			this._debounceTimers = {}; // Debounce timers for mouseover events
			this._prefetchedUrls = new Set(); // Set to keep track of prefetched URLs
			this.observer = null; // IntersectionObserver instance
			this.CACHE_LIMIT = 100; // Cache limit
			this._prefix = window.KT_PREFIX || '';
			this._listenerController = null;

			this.init();

		}

		init() {

			if ( this.hasAttribute('data-enable-skeleton' ) && this.closest(`.${this._prefix}has-skeleton`) ) {
				const skeleton = this.closest(`.${this._prefix}has-skeleton`).querySelector(`[data-js-product-item-skeleton]`);
				this.skeletonElements = [...skeleton.querySelector(`.${this._prefix}product-item__text`).children];
				this.skeletonSettings = JSON.parse(skeleton.querySelector('[data-product-skeleton-settings]').textContent);
			}

			this._event = new Event('VARIANT_CHANGE');

			this.productPage = this.closest('[data-js-product-component]');

			this.productForm = document.querySelector(`#product-form-${this.dataset.id}`);
			if ( this.productForm ) {
				this.productQty = this.productForm.querySelector('[data-js-product-quantity]');
				this.addToCart = this.productForm.querySelector('[data-js-product-add-to-cart]');
				this.addToCartText = this.productForm.querySelector('[data-js-product-add-to-cart-text]');
			}

			this.addEventListener('change', this.onOptionChange.bind(this));
			let initVariantChange = false;

			if ( this.hasAttribute('data-variant-required' ) ) {
				this.variantRequired = true;
				this.noVariantSelectedYet = true;
				this.fauxVariant = JSON.parse(this.querySelector('[data-js-variant-data]').textContent);
				if ( document.location.search.includes('variant') && this.hasAttribute('data-main-product-page-variants') ) {
					const initVariant = parseInt(new URLSearchParams(document.location.search).get('variant'));
					if ( initVariant ) {
						this.updateCurrentVariant();
						this.variantRequired = false;
						this.noVariantSelectedYet = false;
						initVariantChange = true;
						this.classList.add(`${this._prefix}variant-selected`);
						this.productPage.classList.add(`${this._prefix}variant-selected`);
						this.querySelectorAll('[data-option-value-id][data-selected]').forEach(elm=>{
							elm.tagName === 'OPTION' ? elm.setAttribute('selected', 'selected') : elm.setAttribute('checked', 'checked');
						});
					}
				} else {
					
					if ( this.getAttribute('data-unavailable-variants') !== 'hide' ) {
						this.querySelectorAll('[disabled]').forEach(elm=>{
							if ( ! elm.hasAttribute('data-disabled') ) {
								elm.removeAttribute('disabled')
							}
						});
						this.querySelectorAll(`.${this._prefix}disabled`).forEach(elm=>{
							elm.classList.remove(`${this._prefix}disabled`)
						});
					}

					this.querySelectorAll('[data-silent-selected]').forEach(elm=>{
						if ( elm.dataset.productUrl == this.dataset.url ) {
							elm.removeAttribute('data-silent-selected');
							elm.tagName === 'OPTION' ? elm.setAttribute('selected', 'selected') : elm.setAttribute('checked', 'checked');
							if ( parseInt(this.dataset.variants) == 1 ) {
								this.variantRequired = false;
								this.noVariantSelectedYet = false;
								this.classList.add(`${this._prefix}variant-selected`);
								this.productPage.classList.add(`${this._prefix}variant-selected`);
								initVariantChange = true;
							}
							this.checkIfSelectedVariant();
							this.updateCurrentVariant();
						}
					});
					const combination = [];
					this.querySelectorAll('[data-option-value-id][data-selected]').forEach(elm=>{
						combination.push(elm.dataset.optionValueId);
					});
					this.debounceOptionLoad(combination.join(',').replace(/,/g, '-'), 1);
				}
			} else {
				this.variantRequired = false;
				this.noVariantSelectedYet = false;
				this.classList.add(`${this._prefix}variant-selected`);
				this.productPage.classList.add(`${this._prefix}variant-selected`);
				this.updateCurrentVariant();
			}

			this.productStock = document.querySelector(`#product-${this.dataset.id} [data-js-variant-quantity]`);
			this.productStockProgress = document.querySelector(`#product-${this.dataset.id} [data-js-variant-quantity-progress]`);
			if ( this.productStock && document.querySelector(`#product-${this.dataset.id} [data-js-variant-quantity-data]`) ) {
				this.updateStock(JSON.parse(document.querySelector(`#product-${this.dataset.id} [data-js-variant-quantity-data]`).getAttribute('data-inventory')));
			}

			if ( initVariantChange ) {
				const combination = [];
				this.querySelectorAll('[data-option-value-id][data-selected]').forEach(elm => {
					combination.push(elm.dataset.optionValueId);
				});
				this.fetchProductUpdates(combination.join(',').replace(/,/g, '-'), this.renderProductUpdates.bind(this), false, true);
			}

			// preloading of option values

			new IntersectionObserver((entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						const combinations = this.getPossibleCombinations();
						combinations.forEach((combination) => {
							this.debounceOptionLoad(combination.join(',').replace(/,/g, '-'));
						});
						this.querySelectorAll('[data-product-url]').forEach(elm=>{
							this.prefetchPage(elm.dataset.productUrl);
						})
					}
				});
			}, {
				rootMargin: '0px',
				threshold: 0.1,
			}).observe(this);

			new MutationObserver(() => {
				const combinations = this.getPossibleCombinations();
				combinations.forEach((combination) => {
					this.debounceOptionLoad(combination.join(',').replace(/,/g, '-'));
				});
				this.querySelectorAll('[data-product-url]').forEach(elm=>{
					this.prefetchPage(elm.dataset.productUrl);
				})
			}).observe(this.querySelector('[data-js-variant-data]'), {
				attributes: false, childList: true, subtree: false
			});

			this.addEventListeners();

		}

		addEventListeners() {

			this.querySelectorAll('[data-option-value-id]').forEach((elm) => {

				if ( elm._hasPreloadListeners ) return;
				elm._hasPreloadListeners = true;

				elm.addEventListener('mouseover', (e) => {
					e.stopPropagation();
					if ( ! e.target.hasAttribute('data-selected') && ! e.target.hasAttribute('data-product-url') ) {
						const combination = this.getSpecificCombinations(e.target, e.target.closest('[data-js-product-variant-container]'));
						this.debounceOptionLoad(combination.join(',').replace(/,/g, '-'), 1);
					} else if ( e.target.hasAttribute('data-custom-product-url' ) ) {
						const combination = this.getSpecificCombinations(e.target, e.target.closest('[data-js-product-variant-container]'));
						this.debounceOptionLoad(combination.join(',').replace(/,/g, '-'), 1, e.target.getAttribute('data-custom-product-url'));
					}
				});

				elm.addEventListener('touchstart', e => {
					e.stopPropagation();
					if ( ! e.target.hasAttribute('data-selected') && ! e.target.hasAttribute('data-product-url') ) {
						const combination = this.getSpecificCombinations(e.target, e.target.closest('[data-js-product-variant-container]'));
						this.debounceOptionLoad(combination.join(',').replace(/,/g, '-'), 1);
					} else if ( e.target.hasAttribute('data-custom-product-url' ) ) {
						const combination = this.getSpecificCombinations(e.target, e.target.closest('[data-js-product-variant-container]'));
						this.debounceOptionLoad(combination.join(',').replace(/,/g, '-'), 1, e.target.getAttribute('data-custom-product-url'));
					}
				}, { passive:true });

			});

		}

		debounceOptionLoad(optionValuesHash, delay = 20) {
			// Debounce function to prevent multiple quick fetches
			if (this._debounceTimers[optionValuesHash]) {
				clearTimeout(this._debounceTimers[optionValuesHash]);
			}
			this._debounceTimers[optionValuesHash] = setTimeout(() => {
				if (!this._cachedOptions.has(optionValuesHash) && !this._loadingOptions.has(optionValuesHash)) {
					this.preloadOption(optionValuesHash);
				}
			}, delay);
		}

		preloadOption(optionValuesHash) {
			// Preload a single option
			this._loadingOptions.add(optionValuesHash);
			this.fetchProductUpdates(optionValuesHash, (html) => {
				this.cacheProductUpdates(html, optionValuesHash);
				this._loadingOptions.delete(optionValuesHash);
			});
		}
	
		prefetchPage(url) {
			// Prefetch the page using a link element
			if ( ! this._prefetchedUrls.has(url) && url !== window.location.pathname ) {
				const link = document.createElement('link');
				link.rel = 'prefetch';
				link.href = url;
				document.head.appendChild(link);
				this._prefetchedUrls.add(url);
			}
		}

		getSelectedOptionHash(){ 
			return [...this.querySelectorAll('select[data-js-product-variant-container], input:checked')]
				.map(el => el.dataset.optionValueId || el.selectedOptions[0]?.dataset.optionValueId)
				.filter(value => value !== undefined)
				.join(',').replace(/,/g, '-');
		}

		getPossibleCombinations() {
	
			const currentSelections = [];
			const options = [];
	
			this.querySelectorAll('[data-js-product-variant-container]').forEach(row => {
				const rowOptions = [];
				let currentSelection = null;

				row.querySelectorAll('[data-option-value-id]').forEach(option => {
					rowOptions.push(option.getAttribute('data-option-value-id'));
					if (option.hasAttribute('data-selected')) {
						currentSelection = option.getAttribute('data-option-value-id');
					}
				});
		
				if (currentSelection === null) {
					//console.error('No selected option found in one of the rows');
					return;
				}
		
				options.push(rowOptions);
				currentSelections.push(currentSelection);
			});
		
			function generatePossibleCombinations(currentSelections, options) {
				const possibleCombinations = [];
		
				for (let i = 0; i < currentSelections.length; i++) {
					const newCombination = [...currentSelections];
					options[i].forEach((option) => {
						if ( option !== currentSelections[i] && ! this.querySelector(`[data-option-value-id="${option}"]`).hasAttribute('data-product-url') ) {
							newCombination[i] = option;
							possibleCombinations.push([...newCombination]);
						}
					});
				}
				return possibleCombinations;
			}
		
			return generatePossibleCombinations.call(this, currentSelections, options);
		}

		getSpecificCombinations(hoveredOption, hoveredRow) {
			const newCombination = [];
			this.querySelectorAll('[data-js-product-variant-container]').forEach(row => {
				if ( row === hoveredRow ) {
					newCombination.push(hoveredOption.dataset.optionValueId);
				} else {
					newCombination.push(row.querySelector('[data-selected]').dataset.optionValueId);
				}
			});
			return newCombination;
		}

		async fetchProductUpdates(optionValuesHash, callback, checkHash = false, force = false, priority = 'auto') {
			// turn from hash to no hash
			// Fetch product updates
			try {
				const response = await fetch(`${this.dataset.url}${this.dataset.url.includes('?') ? '&' : '?'}section_id=${this.dataset.helperId}&option_values=${optionValuesHash.replace(/-/g, ',')}`, {priority: priority});
				const responseText = await response.text();
				const html = new DOMParser().parseFromString(responseText, 'text/html');
				if ( optionValuesHash === this.currentOptionValueHash || checkHash === false || force ) {
					callback(html, optionValuesHash);
				}
			} catch (error) {
				console.error(`Error fetching options ${optionValuesHash}:`, error);
				this._loadingOptions.delete(optionValuesHash);
			}
		}

		async fetchAndReloadProductItem(url, productItem) {

			productItem.classList.add('loading');

			try {

				const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}section_id=helper-product-item`);	
				let responseText = await response.text();
				const responseId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
				responseText = responseText.replaceAll(/UNIQUE_ID/g, responseId);

				const html = new DOMParser().parseFromString(responseText, 'text/html');
				KROWN.productItemUpdateHelper(productItem, responseId, html, {elements: this.skeletonElements, settings: this.skeletonSettings});
				productItem.classList.remove('loading');

				productItem.dispatchEvent(new Event('reload', { bubbles: true }));

			} catch (error) {
				console.error(`Error`, error); 
				productItem.classList.remove('loading');
			}
		}		
		
		async fetchAndReloadProductPage(url, productPage) {

			productPage.classList.add('loading');

			try {
				const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}view=quick-view`);	
				let responseText = await response.text();
				const quickViewHTML = new DOMParser().parseFromString(responseText, 'text/html').querySelector('#product-quick-view');
				productPage.innerHTML = quickViewHTML.innerHTML;
				productPage.classList.remove('loading');
				productPage.dispatchEvent(new Event('reload', { bubbles: true }));
			} catch (error) {
				console.error(`Error`, error); 
				productPage.classList.remove('loading');
			}
		}

		cacheProductUpdates(html, optionValuesHash) {
			// Cache the fetched HTML with LRU eviction
			if (this._cachedOptions.size >= this.CACHE_LIMIT) {
				// Remove the oldest item (first entry in the Map)
				const oldestKey = this._cachedOptions.keys().next().value;
				this._cachedOptions.delete(oldestKey);
			}
	
			// Add the new item
			this._cachedOptions.set(optionValuesHash, html);
			// Ensure the most recently accessed item is moved to the end of the Map
			this._updateCacheOrder(optionValuesHash);
		}

		_updateCacheOrder(optionValuesHash) {
			// Move the accessed item to the end to mark it as recently used
			const value = this._cachedOptions.get(optionValuesHash);
			this._cachedOptions.delete(optionValuesHash);
			this._cachedOptions.set(optionValuesHash, value);
		}

		onOptionChange(e) {
			const variant = e.target;
			const targetUrl = variant instanceof HTMLSelectElement ? variant.selectedOptions[0].dataset.productUrl : variant.dataset.productUrl;
			const variantId = variant instanceof HTMLSelectElement ? variant.selectedOptions[0].dataset.variantId : variant.dataset.variantId
			const optionValuesHash = this.getSelectedOptionHash();
			this.currentOptionValueHash = optionValuesHash;
			this.addEventListeners();

			if ( targetUrl !== '' && targetUrl !== undefined && targetUrl !== this.dataset.url ) {
				if ( variant.hasAttribute('data-product-custom-url') || ( variant instanceof HTMLSelectElement && variant.selectedOptions[0].hasAttribute('data-product-custom-url') ) ) {
					if ( variant.dataset.productCustomUrl == 'product' ) {
						this.fetchAndReloadProductItem(targetUrl, variant.closest('[data-js-product-item]'));
					} else {
						this.fetchAndReloadProductPage(targetUrl, variant.closest('[data-js-product-page]'));
					}
				} else {
					window.location.assign(targetUrl);
				}

			} else {

				if ( this.variantRequired && this.noVariantSelectedYet ) {
					this.checkIfSelectedVariant();
				}
				
				if ( this.noVariantSelectedYet == false ) {
					if (this._cachedOptions.has(optionValuesHash)) {
						// Use cached content if available
						this.renderProductUpdates(this._cachedOptions.get(optionValuesHash));
						this._updateCacheOrder(optionValuesHash);
					} else {
						// Fetch updates if not cached
						this.fetchProductUpdates(optionValuesHash, this.renderProductUpdates.bind(this), true, false, 'high');
					}
					this.updateURL(variantId);

				}

			}

		}

		renderProductUpdates(html) {

			const newHTML = html.querySelector(`#product-${this.hasAttribute('data-render-with-helper') ? this.dataset.helperId : this.dataset.id}`);

			// update variant specific blocks
			
			newHTML.querySelectorAll('[data-update-block]').forEach(elm=>{
				if ( ! elm.hasAttribute('data-update-block-inner') ) {
					const target = this.productPage.querySelector(`[data-update-block="${elm.dataset.updateBlock}"]`);
					if ( target ) {
						target.innerHTML = elm.innerHTML;
					}
				}
			});

			// update product id (selected variant)
			const newVariantInput = newHTML.querySelector('input[name="id"]');
			if ( newVariantInput ) {
				this.productPage.querySelectorAll('input[name="id"]').forEach(elm=>{
					if ( elm.closest('[data-js-product-component]') === this.productPage ) {
						elm.value = newVariantInput.value;
					}
				});
			}
			
			// update current variant and available options
			this.updateCurrentVariant();
			this.updateOptions(newHTML.querySelectorAll('[data-main-product-variants] [data-option-value-id]'));

			// handle stock related updates
			if ( this.productStock && newHTML.querySelector('[data-js-variant-quantity-data]' ) ) {
				this.updateStock(JSON.parse(newHTML.querySelector('[data-js-variant-quantity-data]').getAttribute('data-inventory')));
			}
			this.updateOutOfStockVariants();
			this.updateBuyButtons();
		
			this.dispatchEvent(this._event);
			KROWN.functions.eventDispatcher('krown:variant:change', {
				variant: this.currentVariant,
				productForm: this.productForm
			});

		}

		updateOptions(optionsData) {

			optionsData.forEach(option => {

				const optionElm = this.querySelector(`[data-option-value-id="${option.dataset.optionValueId}"]`);

				optionElm.setAttribute('data-available', option.dataset.available);
				optionElm.setAttribute('data-variant-id', option.dataset.variantId);
				if ( option.hasAttribute('data-product-url') != '' ) {
					optionElm.setAttribute('data-product-url', option.dataset.productUrl);
				} else {
					optionElm.removeAttribute('data-product-url');
				}
				if ( option.hasAttribute('data-selected') ) {
					optionElm.setAttribute('data-selected', '');
					optionElm.setAttribute(`${optionElm instanceof HTMLOptionElement ? 'selected' : 'checked'}`, '');
				} else {
					optionElm.removeAttribute('data-selected');
					optionElm.removeAttribute(`${optionElm instanceof HTMLOptionElement ? 'selected' : 'checked'}`, '');
				}

				if ( this.dataset.unavailableVariants != 'show' && option.dataset.available == 'false' && ! ( optionElm.hasAttribute('data-product-url') ) ) {
					optionElm.setAttribute('disabled', 'disabled');
				} else {
					if ( ! optionElm.hasAttribute('data-disabled') ) {
						optionElm.removeAttribute('disabled');
					}
				}

				if ( option.dataset.available == 'true' ) {
					if ( ! (optionElm instanceof HTMLOptionElement) ) {
						optionElm.classList.remove(`${this._prefix}disabled`);
						optionElm.closest(`.${this._prefix}product-variant__item`).classList.remove(`${this._prefix}disabled`);
					}
				} else {
					if ( ! (optionElm.hasAttribute('data-product-url') ) ) {
						if ( ! (optionElm instanceof HTMLOptionElement) ) {
							optionElm.classList.add(`${this._prefix}disabled`);
							optionElm.closest(`.${this._prefix}product-variant__item`).classList.add(`${this._prefix}disabled`);
						}
					}
				}

			});

		}

		updateBuyButtons(){
			if ( this.productForm ) {
				if ( ! this.currentVariant || ! this.currentVariant.available ) {
					if ( this.productQty ) this.productQty.style.display = 'none';
					this.addToCart.classList.add(`${this._prefix}disabled`);
					this.productForm.classList.add(`${this._prefix}disabled-cart`);
					this.addToCartText.textContent = KROWN.settings.locales.products_sold_out_variant;
				} else {
					if ( this.productQty ) this.productQty.style.display = '';
					this.addToCart.classList.remove(`${this._prefix}disabled`);
					this.productForm.classList.remove(`${this._prefix}disabled-cart`);
					this.addToCartText.textContent = this.hasAttribute('data-show-bundle-wording') ? KROWN.settings.locales.products_add_to_bundle_button : this.addToCartText.hasAttribute('data-show-preorder-wording') ? KROWN.settings.locales.products_preorder_button : KROWN.settings.locales.products_add_to_cart_button;
				}
				if ( ! this.currentVariant ) {
					this.productForm.classList.add(`${this._prefix}unavailable-variant`);
					this.addToCartText.textContent = (this.variantRequired && this.noVariantSelectedYet) ? KROWN.settings.locales.products_variant_required : KROWN.settings.locales.products_unavailable_variant;
				} else {
					this.productForm.classList.remove(`${this._prefix}unavailable-variant`);
				}
			}
		}

		updateCurrentVariant(){
			this.currentVariant = JSON.parse(this.querySelector('[data-js-variant-data]').textContent);
			if ( this.currentVariant == null ) {
				this.currentVariant = false;
			}
		}

		updateStock(productStockData){

			if ( this.productStock ) {

				if ( ! this.currentVariant) {
					if ( this.productStock ) {
						this.productStock.innerHTML = '';
					}
				} else {


					if ( this.productStock && productStockData[0] ) {

						let currentVariant = productStockData[0];
						
						this.productStock.innerHTML = '';

						if ( currentVariant ) {

							if ( currentVariant.quantity <= 0 ) {
								if ( currentVariant.inventory == 'continue' ) {
									this.productStock.innerHTML = KROWN.settings.locales.products_preorder;
									this.productStock.setAttribute('data-stock', 'pre-order');
								} else if ( currentVariant.inventory == 'deny' ) {
									this.productStock.innerHTML = KROWN.settings.locales.products_no_products;
									this.productStock.setAttribute('data-stock', 'out-of-stock');
								}
							} else if ( currentVariant.quantity == '1' ) {
								this.productStock.innerHTML = KROWN.settings.locales.products_one_product;
								this.productStock.setAttribute('data-stock', 'one-item-stock');
							} else if ( currentVariant.quantity <= parseInt(this.productStock.dataset.lowStock) ) {
								this.productStock.innerHTML = KROWN.settings.locales.products_few_products.replace('{{ count }}', currentVariant.quantity);
								this.productStock.setAttribute('data-stock', 'little-stock');
							} else if ( currentVariant.unavailable ) {
								this.productStock.innerHTML = KROWN.settings.locales.products_no_products;
								this.productStock.setAttribute('data-stock', 'out-of-stock');
							} else if ( currentVariant.quantity > parseInt(this.productStock.dataset.lowStock) && this.productStock.dataset.type == "always" ) {
								this.productStock.innerHTML = KROWN.settings.locales.products_many_products.replace('{{ count }}', currentVariant.quantity);
								this.productStock.setAttribute('data-stock', 'in-stock');
							} else if ( ! currentVariant.quantity && this.productStock.dataset.type == "always" )  {
								this.productStock.innerHTML = KROWN.settings.locales.products_enough_products;
								this.productStock.setAttribute('data-stock', 'in-stock');
							}

							if ( this.productStockProgress ) {
								let progressQty = 0;
								if ( currentVariant.quantity <= 0 && currentVariant.inventory == 'continue' || typeof currentVariant.quantity === 'undefined' ) {
									progressQty = parseInt(this.productStock.dataset.highStock);
								} else if ( currentVariant.quantity > 0 ) {
									progressQty = currentVariant.quantity;
								}
								if ( progressQty >= parseInt(this.productStock.dataset.highStock)  ) {
									this.productStockProgress.style.width = `100%`;
								} else {
									this.productStockProgress.style.width = `${100 * progressQty / parseInt(this.productStock.dataset.highStock)}%`;
								}
							}

						}
					}
				}
			}
		}

		updateOutOfStockVariants() {

			// Check if all the variants in a group are disabled, show an "out of stock" message

			this.querySelectorAll('[data-js-product-variant]').forEach(variant=>{
				let allDisabled = true;
				variant.classList.remove(`${this._prefix}product-variant--all-disabled`);
				variant.querySelector(`.${this._prefix}product-variant__out-of-stock`)?.classList.add(`${this._prefix}hide`);
				variant.querySelector(`.${this._prefix}product-variant__out-of-stock`)?.setAttribute('aria-hidden', 'true');
				variant.querySelectorAll(`.${this._prefix}product-variant-value`).forEach(variantInput=>{
					if ( ! ( variantInput.hasAttribute('disabled') || variantInput.classList.contains(`${this._prefix}disabled`) ) ) {
						allDisabled = false;
					}
				});
				if ( allDisabled ) {
					variant.classList.add(`${this._prefix}product-variant--all-disabled`);
					variant.querySelector(`.${this._prefix}product-variant__out-of-stock`)?.classList.remove(`${this._prefix}hide`);
					variant.querySelector(`.${this._prefix}product-variant__out-of-stock`)?.removeAttribute('aria-hidden');
				}	
			});

		}

		updateURL(variantId = '') {
			if (!this.hasAttribute('data-no-history') && variantId !== '') {
				window.history.replaceState({}, '', `${this.dataset.url}?variant=${variantId}`);
			}
		}

		checkIfSelectedVariant(){

			this.options = [];
			this.querySelectorAll('[data-js-product-variant-container]').forEach(elm=>{
				if ( elm.dataset.jsProductVariantContainer == 'radio' ) {
					elm.querySelectorAll(`.${this._prefix}product-variant__input`).forEach(el=>{
						if ( el.checked ) {
							this.options.push(el.value);
						}
					});
				} else {
					if ( ! ( this.variantRequired && elm.selectedIndex == 0 ) ) {
						this.options.push(elm.value);
					}
				}
			});
			if ( this.variantRequired && this.noVariantSelectedYet && this.options.length >= parseInt(this.dataset.variants) ) {
				this.noVariantSelectedYet = false;
				this.classList.add(`${this._prefix}variant-selected`);
				this.productPage.classList.add(`${this._prefix}variant-selected`);
			}

		}

	}


  if ( typeof customElements.get('product-variants') == 'undefined' ) {
		customElements.define('product-variants', ProductVariants);
	}

}

/* ---
	Product Form
--- */

if ( typeof ProductForm !== 'function' ) {

	class ProductForm extends HTMLElement {
		constructor() {
			super();   
			this._prefix = window.KT_PREFIX || '';
			this.init();
		}

		init(){
			this.productPage = this.closest('[data-js-product-component]');
			this.cartType = this.hasAttribute('data-ajax-cart') ? ( KROWN.settings.cart_action == 'popup' ? 'popup' : 'ajax' ) : 'page';
			if ( ! document.body.classList.contains('template-cart') || this.hasAttribute('data-force-form' ) ) {
				this.form = this.querySelector('form');
				this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
				this.ADD_TO_CART = new Event('add-to-cart');
			}
			if ( document.body.classList.contains('touchevents') ) {
				const submitButton = this.querySelector('[type="submit"]');
				if ( submitButton ) {
					submitButton.addEventListener('touchend', e=>{
						//submitButton.click();
					});
				}
			}
		}

		onSubmitHandler(e) {	

			e.preventDefault();
			
			const submitButton = this.querySelector('[type="submit"]');

			submitButton.classList.add(`${this._prefix}working`);

			const body = this._serializeForm(this.form);
			let alert = '';

			let customPropertiesRequired = false;

			if ( this.productPage ) {
				this.productPage.querySelectorAll('[data-js-custom-property]').forEach(elm=>{
					if ( elm.querySelector('[required]') ) {

						if ( elm.classList.contains(`${this._prefix}product-variants--text` ) ) {
							const txtInputElm = elm.querySelector('input') || elm.querySelector('textarea');
							if ( txtInputElm.value == '' ) {
								customPropertiesRequired = true;
								txtInputElm.focus();
								elm.querySelector(`.${this._prefix}product-variant__required`).style.display = 'block';
							}
						} else if ( elm.classList.contains(`${this._prefix}product-variants--select` ) ) {
							if ( elm.querySelector('select').value == '' ) {
								customPropertiesRequired = true;
								elm.querySelector('select').focus();
								elm.querySelector(`.${this._prefix}product-variant__required`).style.display = 'block';
							}
						} else if ( elm.classList.contains(`${this._prefix}product-variants--checkbox` ) ) {
							if ( ! elm.querySelector('input:checked') ) {
								customPropertiesRequired = true;
								elm.querySelector('input').focus();
								elm.querySelector(`.${this._prefix}product-variant__required`).style.display = 'block';
							}
						}

						elm.addEventListener('click', ()=>{
							elm.querySelector(`.${this._prefix}product-variant__required`).style.display = 'none';
						});

					}
				});
			}

			if ( customPropertiesRequired ) {
				submitButton.classList.remove(`${this._prefix}working`);
				return false;
			}

			if ( ! customPropertiesRequired ) {

				fetch(`${KROWN.settings.routes.cart_add_url}.js`, {
					body,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						'X-Requested-With': 'XMLHttpRequest'
					},
					method: 'POST'
				})
					.then(response => response.json())
					.then(response => {
						if ( response.status == 422 ) {
							// wrong stock logic alert
							alert = document.createElement('span');
							alert.className = `${this._prefix}alert ${this._prefix}alert--error`;
							if ( typeof response.description === 'string' ) {
								alert.innerHTML = response.description;
							} else {
								if ( response.errors.send_on ) {
									alert.innerHTML = response.errors.send_on;
								} else {
									alert.innerHTML = response.message;
								}
							}
							if ( this.cartType == 'page' || this.cartType == 'popup' ) {
								if ( document.getElementById('product-page-form-error-cart-alert') ) {
									document.getElementById('product-page-form-error-cart-alert').remove();
								}
								alert.style.marginTop = '1em';
								alert.style.marginBottom = '0';
								alert.id = 'product-page-form-error-cart-alert';
								this.form.parentElement.append(alert);
								return false;
							}
							return fetch('?section_id=helper-cart');
						} else {
							if ( this.cartType == 'page' ) {
								document.location.href = KROWN.settings.routes.cart_url;
								return false;
							} else if ( this.cartType == 'popup' ) {
								return fetch(`${this.dataset.productUrl}?variant=${this.querySelector('input[name="id"]').value}&section_id=helper-cart-popup`);
							} else {
								return fetch('?section_id=helper-cart');
							}
						}
					})
					.then(response => response.text())
					.then(text => {

						const sectionInnerHTML = new DOMParser().parseFromString(text, 'text/html');

						if ( this.cartType == 'ajax' ) {
							
							const cartFormInnerHTML = sectionInnerHTML.getElementById('AjaxCartForm').innerHTML;
							const cartSubtotalInnerHTML = sectionInnerHTML.getElementById('AjaxCartSubtotal').innerHTML;

							if ( document.getElementById('AjaxCartForm') ) {
								const cartItems = document.getElementById('AjaxCartForm');
								cartItems.innerHTML = cartFormInnerHTML;
								cartItems.ajaxifyCartItems();
								if ( alert != '' ) {
									document.getElementById('AjaxCartForm').querySelector('form').prepend(alert);
								}
								document.getElementById('AjaxCartSubtotal').innerHTML = cartSubtotalInnerHTML;
							}

						} else {
							if ( document.querySelector('[data-js-site-cart-popup-content]') ) {
								document.querySelector('[data-js-site-cart-popup-content]').innerHTML = sectionInnerHTML.querySelector('.shopify-section').innerHTML;
							}
						}

						document.querySelectorAll('[data-header-cart-count]').forEach(elm=>{
							elm.textContent = sectionInnerHTML.querySelector('[data-cart-count]').textContent;
						});
						document.querySelectorAll('[data-header-cart-total]').forEach(elm=>{
							elm.textContent = sectionInnerHTML.querySelector('[data-cart-total]').textContent;
						});

						this.dispatchEvent(this.ADD_TO_CART);
						KROWN.functions.eventDispatcher('krown:cart:add', {
							productForm: this.querySelector('form'),
							variantId: this.querySelector('input[name="id"]').value
						});

						// a11y
						if ( document.getElementById('screen-reader-info') ) {
							document.getElementById('screen-reader-info').innerText = `${KROWN.settings.locales.cart_announcement}`;
							setTimeout(()=>{
								document.getElementById('screen-reader-info').innerText = '';
							}, 1000);
						}

					})
					.catch(e => {
						console.log(e);
					})
					.finally(() => {
						submitButton.classList.remove(`${this._prefix}working`);
					});

			}
		}

		_serializeForm(form) {
			let arr = [];
			Array.prototype.slice.call(form.elements).forEach(function(field) {
				if (
					!field.name ||
					field.disabled ||
					['file', 'reset', 'submit', 'button'].indexOf(field.type) > -1
				)
					return;
				if (field.type === 'select-multiple') {
					Array.prototype.slice.call(field.options).forEach(function(option) {
						if (!option.selected) return;
						arr.push(
							encodeURIComponent(field.name) +
								'=' +
								encodeURIComponent(option.value)
						);
					});
					return;
				}
				if (['checkbox', 'radio'].indexOf(field.type) > -1 && !field.checked)
					return;
				arr.push(
					encodeURIComponent(field.name) + '=' + encodeURIComponent(field.value)
				);
			});
			return arr.join('&');
		}

	}

  if ( typeof customElements.get('product-form') == 'undefined' ) {
		customElements.define('product-form', ProductForm);
	}

}

/* ---
	Product Recommendations
--- */

if ( typeof ProductRecommendations !== 'function' ) {
	class ProductRecommendations extends HTMLElement {

		constructor() {

			super();  
      
      const SUCCESS = new Event('product-recommendations-loaded');
      const FAIL = new Event('product-recommendations-error');

      const handleIntersection = (entries, observer) => {
        if (!entries[0].isIntersecting) return;
        observer.unobserve(this);

        fetch(this.dataset.url)
          .then(response => response.text())
          .then(text => {
            const innerHTML = new DOMParser()
                .parseFromString(text, 'text/html')
                .querySelector(`product-recommendations`);

							if ( innerHTML && innerHTML.querySelectorAll(`[data-js-product-item]`).length > 0 ) {
              this.innerHTML = innerHTML.innerHTML;
              this.querySelectorAll('form').forEach(elm=>{
                if (elm.querySelector('template')) {
                  elm.append(elm.querySelector('template').content.cloneNode(true));
                }
              });
              this.dispatchEvent(SUCCESS);
            } else {
							this.dispatchEvent(FAIL);
						}
          })
          .catch(e => {
						this.dispatchEvent(FAIL);
          });
      }

			new IntersectionObserver(handleIntersection.bind(this), {rootMargin: `0px 0px 400px 0px`}).observe(this);

		}

	}
	
  if ( typeof customElements.get('product-recommendations') == 'undefined' ) {
		customElements.define('product-recommendations', ProductRecommendations);
	}

}

/* ---
	Gift card recipent
--- */

if ( typeof GiftCardRecipient !== 'function' ) {

	class GiftCardRecipient extends HTMLElement {

		constructor() {

			super();

			const properties = Array.from(this.querySelectorAll('[name*="properties"]'));
			const checkboxPropertyName = 'properties[__shopify_send_gift_card_to_recipient]';

			this._prefix = window.KT_PREFIX || '';
			this.recipientCheckbox = properties.find(input => input.name === checkboxPropertyName);
			this.recipientOtherProperties = properties.filter(input => input.name !== checkboxPropertyName);
			this.recipientFieldsContainer = this.querySelector(`.${this._prefix}gift-card-recipient__fields`);

			if ( this.recipientCheckbox ) {
				this.recipientCheckbox.addEventListener('change', this.synchronizeProperties.bind(this));
			}
			this.synchronizeProperties();

		}

		synchronizeProperties() {
			this.recipientOtherProperties.forEach(property => property.disabled = !this.recipientCheckbox.checked);
			this.recipientFieldsContainer.classList.toggle(`${this._prefix}hide`, !this.recipientCheckbox.checked);
		}

	}

  if ( typeof customElements.get('gift-card-recipient') == 'undefined' ) {
		customElements.define('gift-card-recipient', GiftCardRecipient);
	}

}

/* ---
	Sticky Add to Cart
--- */

if ( typeof StickyAddToCart !== 'function' ) {
	class StickyAddToCart extends HTMLElement {
		
		constructor() {

			super();  

			const productPage = document.getElementById(this.dataset.id);
			this.hasAttribute('data-append-to') ? document.querySelector(this.dataset.appendTo).appendChild(this) : document.body.appendChild(this);
			
			const productButton = productPage.querySelector('[data-js-product-add-to-cart]');
			const stickyBar = this;
			
			function toggleStickyBarOnScroll() {
				const rect = productButton.getBoundingClientRect();
				const isInViewport = (
						rect.top >= 0 &&
						rect.left >= 0 &&
						( rect.bottom - 80 ) <= (window.innerHeight || document.documentElement.clientHeight) &&
						rect.right <= (window.innerWidth || document.documentElement.clientWidth)
				);
				const isMobile = window.innerWidth < 728;

				if ( ( ! isMobile && rect.top < 0 ) || ( isMobile && ! isInViewport ) ) {
					stickyBar.classList.add(`${(window.KT_PREFIX || '')}visible`);
				} else {
					stickyBar.classList.remove(`${(window.KT_PREFIX || '')}visible`);
				}
			}
			window.addEventListener('scroll', toggleStickyBarOnScroll, { passive: true });
			toggleStickyBarOnScroll();

			if ( this.hasAttribute('data-single') ) {

				const stickyButton = this.querySelector('button[data-js-atc]');
				const productPage = document.querySelector(`#${this.dataset.id}`);

				stickyButton.addEventListener('click', ()=>{
					productButton.click();
					stickyButton.classList.add(`${(window.KT_PREFIX || '')}working`);
				});
				
				new MutationObserver(()=>{
					if ( productButton.classList.contains(`${(window.KT_PREFIX || '')}working`) ) {
						stickyButton.classList.add(`${(window.KT_PREFIX || '')}working`);
					} else {
						stickyButton.classList.remove(`${(window.KT_PREFIX || '')}working`);
					}
				}).observe(productButton, {
					attributes: true, childList: false, subtree: false
				})
				
				if ( productPage.classList.contains(`${(window.KT_PREFIX || '')}variant-selected`) ) {
					this.classList.add(`${(window.KT_PREFIX || '')}variant-selected`);
				} else {
					new MutationObserver(()=>{
						if ( productPage.classList.contains(`${(window.KT_PREFIX || '')}variant-selected`) ) {
							this.classList.add(`${(window.KT_PREFIX || '')}variant-selected`);
						} else {
							this.classList.remove(`${(window.KT_PREFIX || '')}variant-selected`);
						}
					}).observe(productPage, {
						attributes: true, childList: false, subtree: false
					});
				}

				// when there are multiple variants

				if ( this.hasAttribute('data-single-with-options') ) {
					const stickyPrice = this.querySelector('[data-js-atc-price]');
					const productPrice = document.querySelector(`#${this.dataset.id} [data-update-block="price-sticky-main"]`);
					if ( stickyPrice !== null && productPrice !== null ) {
						stickyPrice.innerHTML = productPrice.innerHTML;
						new MutationObserver(()=>{
							stickyPrice.innerHTML = productPrice.innerHTML;
						}).observe(productPrice, {
							attributes: false, childList: true, subtree: false
						})
					}
				}

			} 

			this.querySelector('button[data-js-choose]')?.addEventListener('click', ()=>{
				productPage.querySelector('product-variants').scrollIntoView({behavior: "smooth", block: "center"});
			});

		}

	}

  if ( typeof customElements.get('sticky-add-to-cart') == 'undefined' ) {
		customElements.define('sticky-add-to-cart', StickyAddToCart);
	}

}

/* ---
	Pickup Availability Widget
--- */

if ( typeof PickupAvailabilityWidget !== 'function' ) {
	class PickupAvailabilityWidget extends HTMLElement {

		constructor(){

			super();

			this._prefix = window.KT_PREFIX || '';
			
			if ( this.querySelector('template') ) {

				const pickupSidebar = this.querySelector('template').content.firstElementChild.cloneNode(true);
				pickupSidebar.id = `site-availability-sidebar-${this.dataset.id}`;

				if ( document.querySelector(`#site-availability-sidebar-${this.dataset.id}`) ) {
					document.querySelector(`#site-availability-sidebar-${this.dataset.id}`).remove();
				}

				document.body.append(pickupSidebar);

				const openSidebarButton = this.querySelector(`.${this._prefix}pickup-availability-widget__more`);

				if ( openSidebarButton ) {
					openSidebarButton.setAttribute('aria-controls', pickupSidebar.id);
					openSidebarButton.setAttribute('aria-expanded', 'false');
					this.querySelector('[data-js-open-site-availability-sidebar]').addEventListener('keydown', e=>{
						if ( e.keyCode == window.KEYCODES.RETURN ) {
							window.lastFocusedElm = this.querySelector('[data-js-open-site-availability-sidebar]');
							setTimeout(()=>{
								pickupSidebar.querySelector('[data-js-close]').focus();
							}, 50);
						}
					});
					this.querySelector('[data-js-open-site-availability-sidebar]').addEventListener('click', e=>{
						pickupSidebar.show();
						openSidebarButton.setAttribute('aria-expanded', 'true');
					});
				}

				const observer = new MutationObserver(()=>{
					pickupSidebar.remove();
					observer.disconnect();
				});
				observer.observe(this.parentElement, {
					attributes: false, childList: true, subtree: false
				});

			}

			this.querySelectorAll(`.${this._prefix}pickup-availability-widget__location-view`).forEach(elm=>{
				elm.addEventListener('click', ()=>{
					document.getElementById(`${elm.getAttribute('aria-controls')}`)?.classList.toggle(`${this._prefix}opened`);
					elm.setAttribute('aria-selected', elm.getAttribute('aria-selected') == "true" ? "false" : "true");
				})
			})

		}

	}

  if ( typeof customElements.get('pickup-availability-widget') == 'undefined' ) {
		customElements.define('pickup-availability-widget', PickupAvailabilityWidget);
	}

}

/* ---
	Product Policies
--- */

if ( typeof ProductPolicies !== 'function' ) {

	class ProductPolicies extends HTMLElement {

		constructor() {

			super();

			this._linkBehavior = this.dataset.policyLink || 'self';
			this._modal = this.querySelector('modal-box') || ( this.dataset.policyModalId ? document.getElementById(this.dataset.policyModalId) : null );

			if ( this._modal && this._modal.parentElement !== document.body ) {
				document.body.appendChild(this._modal);
			}

			this.querySelectorAll('a').forEach(link => {

				switch ( this._linkBehavior ) {

					case 'popup':
						if ( this._modal ) {
							link.addEventListener('click', e => {
								e.preventDefault();
								this._modal.show();
							});
						}
						break;

					case 'blank':
						link.setAttribute('target', '_blank');
						link.setAttribute('rel', 'noopener');
						break;

				}

			});

		}

	}

	if ( typeof customElements.get('product-policies') == 'undefined' ) {
		customElements.define('product-policies', ProductPolicies);
	}

}

/* ---
	Coupon Code
--- */
if ( typeof CouponCode !== 'function' ) {
	class CouponCode extends HTMLElement {
		constructor() {
			super();

			this.querySelectorAll('[data-copy-coupon]').forEach(btn => {
				btn.addEventListener('click', () => {
					const code = btn.closest('.product-coupon-code__code').querySelector('[data-coupon-code]').textContent.trim();
					const el = document.createElement('textarea');
					el.value = code;
					el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
					document.body.appendChild(el);
					el.select();
					document.execCommand('copy');
					document.body.removeChild(el);
					btn.classList.add('copied');
					setTimeout(() => btn.classList.remove('copied'), 2000);
				});
			});
		}
	}

	if ( typeof customElements.get('coupon-code') == 'undefined' ) {
		customElements.define('coupon-code', CouponCode);
	}
}