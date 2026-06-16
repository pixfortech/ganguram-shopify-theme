if ( typeof ProductPage !== 'function' ) {

	class ProductPage extends HTMLElement {

		constructor(){

			super();

			this.productGallery = this.querySelector('[data-js-product-gallery]');
			this.productSlider = this.querySelector('css-slider');

			// Gallery thumbnails

			if ( this.productSlider ) {

				const productGaleryThumbnails = this.querySelector('.product-gallery__thumbnails-holder');

				if ( this.querySelector('.product-gallery__thumbnails .thumbnail') ) {

					this.querySelectorAll('.product-gallery__thumbnails .thumbnail').forEach((elm, i)=>{
						if ( i == 0 )  {
							elm.classList.add('active');
						}
						elm.addEventListener('click',e=>{
							if ( this.productSlider.sliderEnabled ) {
								this.productSlider.changeSlide(e.currentTarget.dataset.index);
							} else {
								window.scrollTo({
									top: this.productGallery.querySelector(`.product-gallery-item[data-index="${e.currentTarget.dataset.index}"]`).offsetTop + this.offsetTop,
									behavior: 'smooth'
								});
								this.thumbnailNavigationHelper(e.currentTarget.dataset.index);
							}
							productGaleryThumbnails.scrollTo({
								left: elm.offsetLeft - 50,
								behaviour: 'smooth'
							})
						});
					})

					this.productSlider.addEventListener('change', e=>{
						this.thumbnailNavigationHelper(e.target.index);
					});

				}

				this.productSlider.addEventListener('change', e=>{
					if ( this.productGallery.querySelector(`.product-gallery-item[data-index="${e.target.index}"]`).dataset.productMediaType == 'model' ) {
						if ( this.xrButton ) {
							this.xrButton.setAttribute('data-shopify-model3d-id', this.productGallery.querySelector(`.product-gallery-item[data-index="${e.target.index}"]`).dataset.mediaId);
						}
						setTimeout(()=>{
							this.productSlider.querySelector('.css-slider-holder').classList.add('css-slider--disable-dragging');
						}, 150);
					}
				});

				// Parallax

				if ( this.productGallery.dataset.jsDisableParallax == 'false' ) {
					this.productSlider.addEventListener('ready', (e)=>{
						
						if ( this.firstProductGalleryIndex ) {
							this.productSlider.changeSlide(this.firstProductGalleryIndex, "auto");
						}

						const productSlides = this.productSlider.querySelectorAll('.product-gallery-item');
						const productFigures = this.querySelectorAll('.apply-gallery-animation');
						this.productSlider.addEventListener('scroll', ()=>{
							const scrollX = -this.productSlider.element.scrollLeft;
							productSlides.forEach((slide,i)=>{
								const media = productFigures[i];
								if ( media ) {
									media.style.transform = `translateX(${( slide.offsetLeft + scrollX ) * -1/3}px)`;
								}
							});
						});

					});
				}

			}

			// show cart drawer when element is added to cart

			if ( ! document.body.classList.contains('template-cart') && ( KROWN.settings.cart_action == 'overlay' || KROWN.settings.cart_action == 'popup' ) ) {
				
				let addToCartEnter = false;
				if ( this.querySelector('[data-js-product-add-to-cart]') ) {
					this.querySelector('[data-js-product-add-to-cart]').addEventListener('keyup', e=>{
						if ( e.keyCode == window.KEYCODES.RETURN ) {
							addToCartEnter = true;
							window.lastFocusedElm = this.querySelector('[data-js-product-add-to-cart]');
						}
					})
				}	

				if ( this.querySelector('[data-js-product-form]') ) {
					this.querySelector('[data-js-product-form]').addEventListener('add-to-cart', ()=>{
						document.getElementById('site-cart-sidebar').show();
						if ( document.getElementById('cart-recommendations') ) {
							document.getElementById('cart-recommendations').generateRecommendations();
						}
						if ( addToCartEnter ) {
							setTimeout(()=>{
								document.querySelector('#site-cart-sidebar [data-js-close]').focus();
								addToCartEnter = false;
							}, 200);
						}
					});
				}

			}

			// Check for models

			const models = this.querySelectorAll('product-model');
			if ( models.length > 0 ) {
				window.ProductModel.loadShopifyXR();
				this.xrButton = this.querySelector('.product-gallery__view-in-space');
			}

			// hide buy now button if stock disabled

			const addToCartButton = this.querySelector('[data-js-product-add-to-cart]');
			if ( addToCartButton ) {
				if ( addToCartButton.classList.contains('disabled') ) {
					this.querySelector('product-form').classList.add('disable-buy-button');
				} else {
					this.querySelector('product-form').classList.remove('disable-buy-button');
				}
				const buyObserver = new MutationObserver(()=>{
					if ( addToCartButton.classList.contains('disabled') ) {
						this.querySelector('product-form').classList.add('disable-buy-button');
					} else {
						this.querySelector('product-form').classList.remove('disable-buy-button');
					}
				});
				buyObserver.observe(addToCartButton,{ attributes: true, childList: false, subtree: false });
			}


			// Product variant event listener for theme specific logic

			this.productVariants = this.querySelector('product-variants[data-main-product-variants]');
			if ( this.productVariants ) {
				this.productVariants.addEventListener('VARIANT_CHANGE', this.onVariantChangeHandler.bind(this));
				this.onVariantChangeHandler({target:this.productVariants});
			}
		}

		thumbnailNavigationHelper(index=0){
			this.querySelectorAll('.product-gallery__thumbnails .thumbnail').forEach((elm, i)=>{
				if ( i == index )
					elm.classList.add('active');
				else 
					elm.classList.remove('active');
			});
		}

		onVariantChangeHandler(e){

			let variant = e.target.currentVariant;
			if ( variant ) {
				
				// image handling

				if ( variant.featured_media != null ) {
					let variantImg = this.productGallery.querySelector('.product-gallery-item[data-media-id="' + variant.featured_media.id + '"]');
					if ( variantImg ) {
						if ( this.productGallery.classList.contains('product-gallery--slider') || ( this.productGallery.classList.contains('product-gallery--scroll') && window.innerWidth < 1024 ) ) {
							if ( this.productGallery.querySelector('css-slider') && this.productGallery.querySelector('css-slider').sliderEnabled ) {
								this.productGallery.querySelector('css-slider').changeSlide(variantImg.dataset.index);
							} else {
								this.firstProductGalleryIndex = variantImg.dataset.index;
							}
						} else {
							window.scrollTo({
								top: variantImg.offsetTop,
								behavior: 'smooth'
							});
						}
					}
				}

			}
		}
	}

  if ( typeof customElements.get('product-page') == 'undefined' ) {
		customElements.define('product-page', ProductPage);
	}

}