if ( typeof QuickAddToCart !== 'function' ) {

	class QuickAddToCart extends HTMLElement {
		constructor(){
			super();
			if ( this.querySelector('product-form') ) {
				this.init();
			}
		}
		init(){
			this.querySelector('product-form').addEventListener('add-to-cart', ()=>{
				if ( ! document.body.classList.contains('template-cart') ) {
					document.getElementById('site-cart-sidebar').show();
					if ( KROWN.settings.cart_action == 'overlay') {
						document.querySelectorAll('[data-header-cart-total]').forEach(elm=>{
							elm.textContent = document.querySelector('#AjaxCartForm [data-cart-total]').textContent;
						});
						document.querySelectorAll('[data-header-cart-count]').forEach(elm=>{
							elm.textContent = document.querySelector('#AjaxCartForm [data-cart-count]').textContent;
						});
						if ( document.getElementById('cart-recommendations') ) {
							document.getElementById('cart-recommendations').generateRecommendations();
						}
					};
				}
			});
		}
	}

  if ( typeof customElements.get('quick-add-to-cart') == 'undefined' ) {
		customElements.define('quick-add-to-cart', QuickAddToCart);
	}

}

if ( typeof QuickViewProduct !== 'function' ) {

	class QuickViewProduct extends HTMLElement {

		constructor(){
			super();
			if ( this.querySelector('a') ) {
				this.init();
			}
		}

		initModalProduct(){

			this.quickViewModal.querySelectorAll('[data-js-close]').forEach(elm=>{
				elm.addEventListener('click', ()=>{
					this.quickViewModal.hide();
				});
			});

			if ( this.quickViewModal.querySelector('[data-js-product-form]') ) {
				this.quickViewModal.querySelector('[data-js-product-form]').addEventListener('add-to-cart', ()=>{
					document.getElementById('site-cart-sidebar')?.scrollTo({top: 0, behavior: 'smooth'});
					this.quickViewModal.hide();
				});
			}

			if ( Shopify && Shopify.PaymentButton ) {
				setTimeout(()=>{
					Shopify.PaymentButton.init();
				}, 50);
			}

			const productVariants = this.quickViewModal.querySelector('product-variants');
			if ( productVariants && ! productVariants._defaultToFirstVariant ) {
				if ( parseInt(productVariants.dataset.variants) == 1 ) {
					productVariants.updateBuyButtons();
					customElements.whenDefined('product-page').then(() => {
						const productPage = this.quickViewModal.querySelector('product-page');
						if ( productPage && typeof productPage.onVariantChangeHandler === 'function' ) {
							productPage.onVariantChangeHandler({target:productVariants});
						}
					});
				}
			}

		}

		init(){

			this.quickViewModal = null;
			this.querySelector('a').addEventListener('keydown', e=>{
				if ( e.keyCode == window.KEYCODES.RETURN ) {
					window.lastFocusedElm = this.querySelector('a');
				}
			})
			this.querySelector('a').addEventListener('click', e=>{

				e.preventDefault();

				if ( ! this.quickViewModal ) {

					const target = e.currentTarget;

					target.classList.add('working');

					fetch(`${target.getAttribute('href')}${ target.getAttribute('href').includes('?') ? '&' : '?' }view=quick-view`)
						.then(response => response.text())
						.then(text => {

							const quickViewHTML = new DOMParser().parseFromString(text, 'text/html').querySelector('#product-quick-view');

							// create modal w content

							const quickViewContainer = document.createElement('div');
							quickViewContainer.innerHTML = `<modal-box id="modal-${target.dataset.id}"	
								class="modal modal--product" 
								data-options='{
									"enabled": false,
									"showOnce": false,
									"blockTabNavigation": true
								}'
								tabindex="-1" role="dialog" aria-modal="true" 
							>
								<div class="container--medium">
									<div class="modal-content" data-js-product-page>
										<button class="modal-close" data-js-close style="position:absolute;margin:0;top:0;right:0">${window.KROWN.settings.symbols.close}</button>
									</div>
								</div>
								<span class="modal-background" data-js-close></span>
							</modal-box>`;

							this.quickViewModal = quickViewContainer.querySelector('modal-box');
							document.body.appendChild(this.quickViewModal);
							this.quickViewModal.querySelector('.modal-content').innerHTML = quickViewHTML.innerHTML;

							setTimeout(()=>{
								this.initModalProduct();
							}, 100);
							this.quickViewModal.querySelector('[data-js-product-page]').addEventListener('reload', ()=>{
								this.initModalProduct();
							});

							if ( ! window.productPageScripts ) {
								const scripts = this.quickViewModal.querySelectorAll('script');
								scripts.forEach(elm=>{
									const script = document.createElement('script');
									script.src = elm.src;
									document.body.append(script);
									window.productPageScripts = true;
								});
							}

							setTimeout(()=>{
								this.quickViewModal.show();
								target.classList.remove('working');
							}, 250);
							
						});

				} else {
					this.quickViewModal.show();
				}

			})
		}
	}

  if ( typeof customElements.get('quick-view-product') == 'undefined' ) {
		customElements.define('quick-view-product', QuickViewProduct);
	}

}