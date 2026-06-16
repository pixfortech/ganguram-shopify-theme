if ( typeof MainHeader !== 'function' ) {

	class MainHeader extends HTMLElement {

		constructor(){
			super();
			this.mount();
		}

		mount(){

			/* -- > DRAWERS < -- */

			// Sticky header

			if ( this.hasAttribute('data-sticky-header') ) {

				const stickyHeader = document.createElement('div');
				stickyHeader.classList = 'sticky-header'
				stickyHeader.setAttribute('data-js-inert', '');
				stickyHeader.innerHTML = `<div class="header__bottom header-container container--large portable-hide">
					${this.querySelector('.header__bottom').innerHTML}
				</div>
				<div class="site-header header__top container--large">
					${this.querySelector('.header__top').innerHTML}
				</div>`;
				document.body.append(stickyHeader);
				this._stickyHeaderEl = stickyHeader;

				if ( this.querySelector('.button--cart-handle') && stickyHeader.querySelector('.header-actions') ) {
					stickyHeader.querySelector('.header-actions').append(this.querySelector('.button--cart-handle').cloneNode(true));
				}

				stickyHeader.querySelectorAll('[id]').forEach(elm=>{
					elm.id = `${elm.id}-sticky`;
				})
				stickyHeader.querySelectorAll('[aria-controls]').forEach(elm=>{
					if ( ! ( elm.hasAttribute('data-js-sidebar-handle') || elm.hasAttribute('data-modal') ) ) {
						elm.setAttribute('aria-controls', `${elm.getAttribute('aria-controls')}-sticky`);
					}
				})

				window.lst = window.scrollY;
				window.lhp = 0;

				const stickyHeaderDeskBound = this.querySelector('.header__bottom');
				const stickyHeaderMobileBound = this.querySelector('.header__top');

				const stickyHeaderMayRemoveShowOnScrollDown = ()=>{
					return ! this._headerMobileSearchExpanded;
				};

				this.SCROLL_StickyHelper = () =>{
					
					var st = window.scrollY;
					try {
						if ( ( st <= 0 || ( window.innerWidth >= 1024 ? stickyHeaderDeskBound.getBoundingClientRect().top >= 0 : stickyHeaderMobileBound.getBoundingClientRect().top >= 0 ) ) && stickyHeader.classList.contains('show') ) {
							stickyHeader.classList.remove('show');
							return;
						}

						if ( st < 0 || Math.abs(lst - st) <= 5 )
							return;	

						if ( st > window.lhp ) {

							if ( st == 0 && stickyHeader.classList.contains('show') ) {

								stickyHeader.classList.remove('show');

							} else if ( st <= lst && ! stickyHeader.classList.contains('show') ) {

								window.lhp = stickyHeader.offsetTop;
								if ( ( window.innerWidth >= 1024 ? stickyHeaderDeskBound.getBoundingClientRect().top : stickyHeaderMobileBound.getBoundingClientRect().top ) < -100 ) {
									stickyHeader.classList.add('show');
								}

							} else if ( st > lst && stickyHeader.classList.contains('show') ) {
								if ( stickyHeaderMayRemoveShowOnScrollDown() ) {
									stickyHeader.classList.remove('show');
								}
							}

						}
					} finally {
						window.lst = st;
					}

				}

				window.addEventListener('scroll', this.SCROLL_StickyHelper, {passive:true});

				stickyHeader.querySelectorAll('.submenu-masonry').forEach(elm=>{
					if ( Macy ) {
						let columns = 4;
						if ( elm.classList.contains('with-2-promotions') ) {
							columns = 2;
						} else if ( elm.classList.contains('with-promotion') ) {
							columns = 3;
						}
						if ( elm.dataset.columns ) {
							columns = parseInt(elm.dataset.columns);
						}
						const submenuMacy = new Macy({
							container: elm,
							columns: columns
						});
						setTimeout(()=>{
							submenuMacy.reInit();
						}, 100);
					}
				});
				
			} else {
				this._stickyHeaderEl = null;
			}

			// drawer cart connections

			document.querySelectorAll('[data-js-sidebar-handle]').forEach(elm => {
				if ( elm.hasAttribute('aria-controls') ) {
					const elmSidebar = document.getElementById(elm.getAttribute('aria-controls'));
					elm.addEventListener('click', e=>{
						e.preventDefault();
						elm.setAttribute('aria-expanded', 'true');
						elmSidebar.show();
					})
					elm.addEventListener('keyup', e=>{
						if ( e.keyCode == window.KEYCODES.RETURN ) {
							elm.setAttribute('aria-expanded', 'true');
							elmSidebar.show();
							window.lastFocusedElm = elm;
							elmSidebar.querySelector('[data-js-close]').focus();
						}
					})
				}
			})
			
			// closing drawers

			document.querySelectorAll('sidebar-drawer [data-js-close]').forEach(elm=>{
				elm.addEventListener('keydown', e=>{
					if ( e.keyCode == window.KEYCODES.RETURN ) {
						if ( window.lastFocusedElm ) {
							setTimeout(()=>{
								window.lastFocusedElm.focus();
								window.lastFocusedElm = null;
							}, 100);
						}
					}
				});
				elm.addEventListener('click', e=>{
					e.preventDefault();
					if ( e.target.closest('.sidebar').classList.contains('sidebar--opened') ) {
						e.target.closest('.sidebar').hide();
					}
				});
			});
			document.querySelector('.site-overlay').addEventListener('click', ()=>{
				if ( document.querySelector('.sidebar--opened') ) {
					document.querySelector('.sidebar--opened').hide();
				}
			});
			document.addEventListener('keydown', e=>{
				if ( e.keyCode == window.KEYCODES.ESC ) {
					if ( document.querySelector('.sidebar--opened') ) {
						document.querySelector('.sidebar--opened').hide();
						if ( window.lastFocusedElm ) {
							window.lastFocusedElm.focus();
							window.lastFocusedElm = null;
						}
					}
				}
			});

			// resizing drawers

			const rootHeight = document.getElementById('root-height');
			this.RESIZE_SidebarHelper = debounce(()=>{
				rootHeight.innerHTML = `:root {
					--window-height: ${window.innerHeight}px;
				}`;
			}, 200);
			window.addEventListener('resize', this.RESIZE_SidebarHelper);
			rootHeight.innerHTML = `:root {
				--window-height: ${window.innerHeight}px;
			}`;

			// Inert elements

			document.querySelectorAll('#main > div').forEach(elm=>{
				if ( ! elm.classList.contains('inert-inside') ) {
					elm.setAttribute('data-js-inert', '');
				}
			})
			window.inertElems = document.querySelectorAll('[data-js-inert]');

			// Init modal windows

			document.querySelectorAll('[aria-controls="modal-store-selector"]').forEach(elm=>{
				elm.addEventListener('keydown', e=>{
					if ( e.keyCode == window.KEYCODES.RETURN ) {
						window.lastFocusedElm = elm;
					}
				})
				elm.addEventListener('click', e=>{
					e.preventDefault();
					if ( document.querySelector('.sidebar--opened') ) {
						document.querySelector('.sidebar--opened').hide();
					}
					if ( document.getElementById(elm.getAttribute('aria-controls')) ) {
						document.getElementById(elm.getAttribute('aria-controls')).show();
					}
				})
				elm.addEventListener('keyup', e=>{
					if ( e.keyCode == window.KEYCODES.RETURN ) {
						if ( document.querySelector('.sidebar--opened') ) {
							document.querySelector('.sidebar--opened').hide();
						}
						if ( document.getElementById(elm.getAttribute('aria-controls')) ) {
							document.getElementById(elm.getAttribute('aria-controls')).show();
						}
					}
				})
			});

			// Submenu alignment

			const rtl = document.documentElement.getAttribute('dir') == 'rtl';
			document.querySelectorAll('.site-nav.style--classic .has-submenu').forEach(elm=>{
				elm.addEventListener('mouseover', ()=>{
					if ( elm.querySelector('.normal-menu') ) {
						elm.querySelector('.normal-menu').style.left = `${rtl ? elm.getBoundingClientRect().right : elm.getBoundingClientRect().left}px`;
					}
				})
			});

			// predictive search

			const bindPredictiveSearchInputListeners = elm=>{
				if ( ! elm ) {
					return;
				}
				elm.addEventListener('focus', ()=>{
					const overlay = document.getElementById(elm.dataset.jsFocusOverlay);
					if ( overlay ) {
						overlay.classList.add('active');
					}
					if ( ! document.body.classList.contains('predictive-script-loaded') ) {
						document.body.classList.add('predictive-script-loaded')
						const predictiveSearchJS = document.createElement('script');
						predictiveSearchJS.src = KROWN.settings.predictive_search_script;
						document.head.appendChild(predictiveSearchJS); 
					}
				})
				elm.addEventListener('keydown', e=>{
					if ( e.keyCode == window.KEYCODES.TAB ) {
						const desktopOverlay = document.getElementById('search-results-overlay-desktop');
						if ( desktopOverlay && desktopOverlay.classList.contains('active') ) {
							desktopOverlay.classList.remove('active');
						}
					}
				})
			};

			if ( JSON.parse(document.getElementById('shopify-features').text).predictiveSearch ) {
				document.querySelectorAll('search-form [data-js-search-input]').forEach(bindPredictiveSearchInputListeners)
				window.addEventListener('load', ()=>{
					document.querySelectorAll('.search-results-overlay').forEach(elm=>{
						elm.style = '';
					})
				});
			} else {
				document.querySelector('search-form [data-js-search-input] + button').classList.add('button--invisibile-trigger');
			}

			// mobile search: reveal on first click, focus on every click (independent per header)

			const mobileSearchSource = this.querySelector('[data-header-mobile-search-panel]');
			const mobileSearchToggles = document.querySelectorAll('[data-header-mobile-search-toggle]');
			this._headerMobileSearchExpanded = false;
			if ( mobileSearchSource && mobileSearchToggles.length ) {

				let mainRevealed = false;
				let stickyRevealed = false;

				const revealMainSearch = ()=>{
					if ( mainRevealed ) {
						return;
					}
					mainRevealed = true;
					this._headerMobileSearchExpanded = true;
					mobileSearchSource.classList.remove('hide');
				};

				const revealStickySearch = ()=>{
					if ( stickyRevealed || ! this._stickyHeaderEl ) {
						return;
					}
					stickyRevealed = true;
					this._headerMobileSearchExpanded = true;
					const clone = mobileSearchSource.cloneNode(true);
					clone.classList.remove('hide');
					clone.setAttribute('data-header-mobile-search-clone', '');
					this._stickyHeaderEl.appendChild(clone);
					clone.querySelectorAll('[id]').forEach(elm=>{
						elm.id = `${elm.id}-sticky`;
					});
					clone.querySelectorAll('[data-js-focus-overlay]').forEach(elm=>{
						const ref = elm.getAttribute('data-js-focus-overlay');
						if ( ref ) {
							elm.setAttribute('data-js-focus-overlay', `${ref}-sticky`);
						}
					});
					if ( JSON.parse(document.getElementById('shopify-features').text).predictiveSearch ) {
						bindPredictiveSearchInputListeners(clone.querySelector('[data-js-search-input]'));
					}
				};

				mobileSearchToggles.forEach(btn=>{
					btn.addEventListener('click', e=>{
						e.preventDefault();
						const fromSticky = this._stickyHeaderEl && btn.closest('.sticky-header');
						if ( fromSticky ) {
							revealStickySearch();
							const input = this._stickyHeaderEl.querySelector('[data-header-mobile-search-panel] input[type=search]');
							if ( input ) {
								input.focus();
							}
						} else {
							revealMainSearch();
							const input = mobileSearchSource.querySelector('input[type=search]');
							if ( input ) {
								input.focus();
							}
						}
						btn.setAttribute('aria-expanded', 'true');
					});
				});
			}

			this._headerSearchQNameSync = e=>{
				if ( e.target.tagName !== 'INPUT' || e.target.name !== 'q' ) {
					return;
				}
				if ( ! e.target.closest('#site-header') && ! e.target.closest('.sticky-header') ) {
					return;
				}
				const enterCode = window.KEYCODES ? window.KEYCODES.RETURN : 13;
				const enterInit = { key: 'Enter', code: 'Enter', keyCode: enterCode, which: enterCode, bubbles: true, cancelable: true };
				document.querySelectorAll('#site-header input[name="q"], .sticky-header input[name="q"]').forEach(el=>{
					if ( el !== e.target ) {
						el.value = '';
						el.dispatchEvent(new KeyboardEvent('keydown', enterInit));
						el.dispatchEvent(new KeyboardEvent('keyup', enterInit));
					}
				});
			};
			document.body.addEventListener('input', this._headerSearchQNameSync);

			// touch navigation for the menu

			const closeTouchSubmenus = (focusedElm, focusedParent=null)=>{
				document.querySelectorAll('.style--classic li.focus').forEach(elm=>{
					if ( ! ( elm === focusedElm || elm === focusedParent ) ) {
						elm.classList.remove('focus');
					}
				})
			}
			let babyMenuTouch = false;
			document.querySelectorAll('.style--classic .has-babymenu').forEach(elm=>{
				elm.addEventListener('touchstart', ()=>{
					elm.firstElementChild.style.pointerEvents = 'none';
					elm.classList.toggle('focus');
					babyMenuTouch = true;
					closeTouchSubmenus(elm,elm.closest('.has-submenu'));
				}, { passive:true });
			})
			document.querySelectorAll('.style--classic .has-submenu').forEach(elm=>{
				if ( ! elm.classList.contains('mega-link') ) {
					elm.addEventListener('touchstart', ()=>{
						elm.firstElementChild.style.pointerEvents = 'none';
						if ( ! babyMenuTouch ) {
							elm.classList.toggle('focus');
							closeTouchSubmenus(elm);
						}
						babyMenuTouch = false;
					}, { passive:true });
				}
			})

			// tab navigation for the menu

			document.querySelectorAll('.site-nav.style--classic .has-submenu > a').forEach(childEl=>{

				const elm = childEl.parentNode;
				const elmMenu = document.getElementById(childEl.getAttribute('aria-controls'));

				elm.addEventListener('keydown', e=>{

					if ( e.keyCode == window.KEYCODES.RETURN ) {
						if ( ! e.target.classList.contains('no-focus-link') ) {
							e.preventDefault();
						}
						if ( ! elm.classList.contains('focus') ) {
							elm.classList.add('focus');
							e.target.setAttribute('aria-expanded', 'true');
							//elmMenu.setAttribute('aria-hidden', 'false');
						} else if ( document.activeElement.parentNode.classList.contains('has-submenu') && elm.classList.contains('focus') ) {
							elm.classList.remove('focus');
							e.target.setAttribute('aria-expanded', 'true');
							//elmMenu.setAttribute('aria-hidden', 'false');
						}
					}
				});	
				
				if ( elm.querySelector('.submenu-holder > li:last-child a') ) {
					elm.querySelector('.submenu-holder > li:last-child a').addEventListener('focusout', e=>{
						if ( elm.classList.contains('focus') ) {
							elm.classList.remove('focus');
							e.target.setAttribute('aria-expanded', 'false');
							//elmMenu.setAttribute('aria-hidden', 'true');
						}
					});
				}

			});

			document.querySelectorAll('.site-nav.style--classic .has-babymenu:not(.mega-link) > a').forEach(childEl=>{	

				const elm = childEl.parentNode;
				const elmMenu = document.getElementById(childEl.dataset.ariaControls);

				elm.addEventListener('keydown', e=>{
					if ( e.keyCode == window.KEYCODES.RETURN ) {
						if ( ! e.target.classList.contains('no-focus-link') ) {
							e.preventDefault();
						}
						if ( ! elm.classList.contains('focus') ) {
							elm.classList.add('focus');
							e.target.setAttribute('aria-expanded', 'true');
							//elmMenu.setAttribute('aria-hidden', 'false');
						} else {
							elm.classList.remove('focus');
							e.target.setAttribute('aria-expanded', 'false');
							//elmMenu.setAttribute('aria-hidden', 'true');
						}
					}
				});

				if ( elm.querySelector('.babymenu li:last-child a') ) {
					elm.querySelector('.babymenu li:last-child a').addEventListener('focusout', e=>{
						if ( elm.parentNode.classList.contains('focus') ) {
							elm.parentNode.classList.remove('focus');
							elm.parentNode.setAttribute('aria-expanded', 'false');
						}
					});
				}

			})

		}

		unmount(){
			window.removeEventListener('resize', this.RESIZE_SidebarHelper);
			if ( this._headerSearchQNameSync ) {
				document.body.removeEventListener('input', this._headerSearchQNameSync);
			}
		}

	}
	
  if ( typeof customElements.get('main-header') == 'undefined' ) {
		customElements.define('main-header', MainHeader);
	}

}

if ( typeof SidebarDrawer !== 'function' ) {

	class SidebarDrawer extends HTMLElement {

		constructor(){
			super();
			this.querySelector('[data-js-close]').addEventListener('click', ()=>{
				this.hide();
			});
			document.addEventListener('keydown', e=>{
				if ( e.keyCode == window.KEYCODES.ESC ) {
					const openedSidebar = document.querySelector('sidebar-drawer.sidebar--opened');
					if ( openedSidebar ){
						openedSidebar.hide();
					}
				}
			});
		}

		/* 
			* generic hide/show functions 
		*/

		show(){

			this.opened = true;
			this.removeAttribute('aria-hidden');
			document.body.classList.add('sidebar-opened');
			if ( this.classList.contains('sidebar--right') ) {
				document.body.classList.add('sidebar-opened--right');
			} else if ( this.classList.contains('sidebar--left') ) {
				document.body.classList.add('sidebar-opened--left');
			}
			this.style.display = 'grid';
			setTimeout(()=>{
				this.classList.add('sidebar--opened');
				window.inertElems.forEach(elm=>{
					elm.setAttribute('inert', '');
				})
			}, 15);
			if ( this.id == "site-cart-sidebar" ) {
				if ( document.querySelector('#cart-recommendations css-slider') ) {
					document.querySelector('#cart-recommendations css-slider').resetSlider();
				}
			}

		}

		hide(){

			this.opened = false;
			this.classList.remove('sidebar--opened');

			document.body.classList.remove('sidebar-opened');
			document.body.classList.remove('sidebar-opened--left');
			document.body.classList.remove('sidebar-opened--right');
			window.inertElems.forEach(elm=>{
				elm.removeAttribute('inert');
			})

			document.querySelector(`[aria-controls="${this.id}"]`)?.setAttribute('aria-expanded', 'false');

			setTimeout(()=>{
				this.style.display = 'none';
			}, 501);

		}

	}


  if ( typeof customElements.get('sidebar-drawer') == 'undefined' ) {
		customElements.define('sidebar-drawer', SidebarDrawer);
	}

}

if ( typeof MobileNavigation !== 'function' ) {
		
	class MobileNavigation extends HTMLElement {

		constructor() {

			super();

			this._openedFirstSubmenu = false;
			this._openedSecondSubmenu = false;

			this.querySelectorAll('.has-submenu > a').forEach(elm=>{
				elm.addEventListener('click', e=>{
					e.preventDefault();
					if ( ! this._openedFirstSubmenu ) {
						this._openedFirstSubmenu = true;
						this.classList.add('opened-first-submenu');
						this.closest('sidebar-drawer').scrollTo({top: 0});
					}
					e.target.closest('li').classList.add('opened');
					this._resizeContainer();
				})
			});

			this.querySelectorAll('.has-babymenu > a').forEach(elm=>{
				elm.addEventListener('click', e=>{
					e.preventDefault();
					if ( ! this._openedSecondSubmenu ) {
						this._openedSecondSubmenu = true;
						this.classList.add('opened-second-submenu');
						this.closest('sidebar-drawer').scrollTo({top: 0});
					}
					e.target.closest('li').classList.add('opened');
					this._resizeContainer();
				})
			});

			this.querySelectorAll('.submenu-back a').forEach(elm=>{
				elm.addEventListener('click', e=>{
					if ( this._openedSecondSubmenu ) {
						this._openedSecondSubmenu = false;
						this.classList.remove('opened-second-submenu');
						this._resizeContainer();
					} else if ( this._openedFirstSubmenu ) {
						this._openedFirstSubmenu = false;
						this.classList.remove('opened-first-submenu');
						this._resizeContainer(true);
					}
					this.closest('sidebar-drawer').scrollTo({top: 0});
					setTimeout(()=>{
						e.target.closest('li.opened').classList.remove('opened');
					}, 301);
					e.preventDefault();
				})
			});

			if ( this.dataset.showHeaderActions == 'true' ) {

				const mobileNavActions = document.createElement('div');
				mobileNavActions.classList = "header-actions flex-buttons";
				mobileNavActions.innerHTML = document.querySelector('[data-js-header-actions]').innerHTML;
				this.querySelector('nav').prepend(mobileNavActions);

				mobileNavActions.querySelectorAll('[id]').forEach(elm=>{
					elm.id = `${elm.id}-mobile`;
				});
				mobileNavActions.querySelectorAll('[data-modal]').forEach(elm=>{
					elm.addEventListener('keydown', e=>{
						if ( e.keyCode == window.KEYCODES.RETURN ) {
							window.lastFocusedElm = elm;
						}
					})
					elm.addEventListener('click', e=>{
						e.preventDefault();
						if ( document.querySelector('.sidebar--opened') ) {
							document.querySelector('.sidebar--opened').hide();
						}
						if ( document.getElementById(elm.getAttribute('aria-controls')) ) {
							document.getElementById(elm.getAttribute('aria-controls')).show();
						}
					})
				});
				
			}

		}

		_resizeContainer(main=false){
      if ( main ) {
				this.style.height = `auto`;
      } else {
				if ( this._openedSecondSubmenu ) {
					this.style.height = `${this.querySelector('.has-babymenu.opened .babymenu').scrollHeight}px`;
				} else if ( this._openedFirstSubmenu ) {
					this.style.height = `${this.querySelector('.has-submenu.opened .submenu').scrollHeight}px`;
				}  
      }
		}

	}

  if ( typeof customElements.get('mobile-navigation') == 'undefined' ) {
		customElements.define('mobile-navigation', MobileNavigation);
	}

}

if ( typeof ScrollableNavigation !== 'function' ) {

	class ScrollableNavigation extends HTMLElement {

		constructor() {

			super();

			this.linkList = this.querySelector('.link-list');
			this.header = this.parentNode;
			window.addEventListener('resize', debounce(()=>{
				this.checkNav();
			}, 200));
			this.checkNav();

			const rtl = document.documentElement.getAttribute('dir') == 'rtl';

			this.parentNode.querySelector('.scrollable-navigation-button--left').addEventListener('click', ()=>{
				this.scroll({
					top: 0,
					left: this.scrollLeft - (rtl ? -100 : 100),
					behavior: 'smooth'
				});
			})
			this.parentNode.querySelector('.scrollable-navigation-button--right').addEventListener('click', ()=>{
				this.scroll({
					top: 0,
					left: this.scrollLeft + (rtl ? -100 : 100),
					behavior: 'smooth'
				});
			})

		}

		checkNav() {
			if ( this.linkList.scrollWidth > this.offsetWidth ) {
				this.header.classList.add('scrolling-navigation-enabled');
			} else {
				this.header.classList.remove('scrolling-navigation-enabled');
			}
		}
		
	}

  if ( typeof customElements.get('scrollable-navigation') == 'undefined' ) {
		customElements.define('scrollable-navigation', ScrollableNavigation);
	}

}