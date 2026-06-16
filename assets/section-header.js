function setCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}
function eraseCookie(name) {   
    document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}
if ( typeof MainHeader !== 'function' ) {

	class MainHeader extends HTMLElement {

		constructor(){
			super();
			this.mount();
		}

		mount(){

			/* -- > DRAWERS < -- */

			document.querySelectorAll('#main > div').forEach(elm=>{
				if ( ! elm.classList.contains('inert-inside') ) {
					elm.setAttribute('data-js-inert', '');
				}
			})
			window.inertElems = document.querySelectorAll('[data-js-inert]');

			// Sticky header

			if ( this.hasAttribute('data-sticky-header') ) {

				const stickyHeader = document.createElement('div');
				stickyHeader.classList = 'sticky-header'
				stickyHeader.innerHTML = `<div class="header__bottom header-container container--large portable-hide">
					${this.querySelector('.header__bottom').innerHTML}
				</div>
				<div class="site-header header__top container--large">
					${this.querySelector('.header__top').innerHTML}
				</div>`;
				document.body.append(stickyHeader);

				stickyHeader.querySelectorAll('[id]').forEach(elm=>{
					elm.id = `${elm.id}`;
				})

				window.lst = window.scrollY;
				window.lhp = 0;

				const stickyHeaderDeskBound = this.querySelector('.header__bottom');
				const stickyHeaderMobileBound = this.querySelector('.header__top');

				this.SCROLL_StickyHelper = () =>{
					
					var st = window.scrollY;
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
							stickyHeader.classList.remove('show');
						}

					} 

					window.lst = st;

				}

				window.addEventListener('scroll', this.SCROLL_StickyHelper, {passive:true});

				stickyHeader.querySelectorAll('.submenu-masonry').forEach(elm=>{
					if ( Macy ) {
						const submenuMacy = new Macy({
							container: elm,
							columns: elm.classList.contains('with-promotion') ? 3 : 4
						});
						setTimeout(()=>{
							submenuMacy.reInit();
						}, 100);
					}
				});
				
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
							elmSidebar.querySelector('[data-js-close]').focus();
						}
					})
				}
			})
			
			// closing drawers

			document.querySelectorAll('sidebar-drawer [data-js-close]').forEach(elm=>{
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

			// Init modal windows

			document.querySelectorAll('[aria-controls="modal-store-selector"]').forEach(elm=>{
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

			document.querySelectorAll('[aria-controls="modal-code-selector"]').forEach(elm=>{
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
			})

			// predictive search

			if ( JSON.parse(document.getElementById('shopify-features').text).predictiveSearch ) {
				document.querySelectorAll('search-form [data-js-search-input]').forEach(elm=>{
					elm.addEventListener('focus', ()=>{
						document.getElementById(elm.dataset.jsFocusOverlay).classList.add('active');
						if ( ! document.body.classList.contains('predictive-script-loaded') ) {
							document.body.classList.add('predictive-script-loaded')
							const predictiveSearchJS = document.createElement('script');
							predictiveSearchJS.src = KROWN.settings.predictive_search_script;
							document.head.appendChild(predictiveSearchJS); 
						}
					})
					elm.addEventListener('keydown', e=>{
						if ( e.keyCode == window.KEYCODES.TAB ) {
							if ( document.getElementById('search-results-overlay-desktop').classList.contains('active') ) {
								document.getElementById('search-results-overlay-desktop').classList.remove('active');
							}
						}
					})
				})
				window.addEventListener('load', ()=>{
					document.querySelectorAll('.search-results-overlay').forEach(elm=>{
						elm.style = '';
					})
				});
			} else {
				document.querySelector('search-form [data-js-search-input] + button').classList.add('button--invisibile-trigger');
			}

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
				elm.addEventListener('touchstart', e=>{
					elm.firstElementChild.style.pointerEvents = 'none';
					elm.classList.toggle('focus');
					babyMenuTouch = true;
					closeTouchSubmenus(elm,elm.closest('.has-submenu'));
				})
			})
			document.querySelectorAll('.style--classic .has-submenu').forEach(elm=>{
				if ( ! elm.classList.contains('mega-link') ) {
					elm.addEventListener('touchstart', e=>{
					elm.firstElementChild.style.pointerEvents = 'none';
					if ( ! babyMenuTouch ) {
						elm.classList.toggle('focus');
						closeTouchSubmenus(elm);
					}
						babyMenuTouch = false;
					})
				}
			})

			// tab navigation for the menu

			document.querySelectorAll('.site-nav.style--classic .has-submenu > a').forEach(childEl=>{

				const elm = childEl.parentNode;

				elm.addEventListener('keydown', e=>{

					if ( e.keyCode == window.KEYCODES.RETURN ) {
						if ( ! e.target.classList.contains('no-focus-link') ) {
							e.preventDefault();
						}
						if ( ! elm.classList.contains('focus') ) {
							elm.classList.add('focus');
							elm.setAttribute('aria-expanded', 'true');
						} else if ( document.activeElement.parentNode.classList.contains('has-submenu') && elm.classList.contains('focus') ) {
							elm.classList.remove('focus');
							elm.setAttribute('aria-expanded', 'true');
						}
					}
				});	
				
				if ( elm.querySelector('.submenu-holder > li:last-child a') ) {
					elm.querySelector('.submenu-holder > li:last-child a').addEventListener('focusout', e=>{
						if ( elm.classList.contains('focus') ) {
							elm.classList.remove('focus');
							elm.setAttribute('aria-expanded', 'false');
						}
					});
				}

			});

			document.querySelectorAll('.site-nav.style--classic .has-babymenu:not(.mega-link) > a').forEach(childEl=>{	

				const elm = childEl.parentNode;

				elm.addEventListener('keydown', e=>{
					if ( e.keyCode == window.KEYCODES.RETURN ) {
						if ( ! e.target.classList.contains('no-focus-link') ) {
							e.preventDefault();
						}
						if ( ! elm.classList.contains('focus') ) {
							elm.classList.add('focus');
							elm.setAttribute('aria-expanded', 'true');
						} else {
							elm.classList.remove('focus');
							elm.setAttribute('aria-expanded', 'false');
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

			document.querySelector(`[aria-controls="${this.id}"]`).setAttribute('aria-expanded', 'false');

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


// code list click event
function capitalizeFirstLetter(str) {
  return str.replace(/\b\w/, function (match) {
    return match.toUpperCase();
  });
}
document.querySelector('.code-click').addEventListener('click', e => {
  var content = document.querySelector(".toggle-button");
  var enteredValue = document.querySelector('.zip_input').value;
  var t =  /^\d+$/.test(enteredValue);  
  if (enteredValue.length == 6 && t == true) {  
    content.classList.remove('active');
    content.classList.remove('modal-code');
    document.body.classList.remove("modal-opened"); 
    content.hide();
    zipcode(enteredValue);
    $('.mss_product').hide();
    setCookie('remove_product', '', { expires: -1 });
  }
});
function zipcode(enteredValue){
  var get_data_url = document.querySelector('.custom-pincode-button').getAttribute('data-code-url'); 
  var get_data_search_product = document.querySelector('.custom-pincode-button').getAttribute('data-search-handle'); 
  var expectedValue = document.querySelector('.custom-pincode-button').getAttribute('data-code-list');
  var expectedCodesArray = expectedValue.split(',');
   var get_url = window.location.href;       
    if (document.body.classList.contains('template-collection')) {       
       const currentUrl = new URL(window.location.href);
       // Append the desired strings
      if(window.location.href.indexOf('?') == -1){
       var modifiedUrl = window.location.href +'/products.json';  
      }else{
       var modifiedUrl = `/collections/all/products.json${currentUrl.search}`;
      }
    }else if (document.body.classList.contains('template-product')) {
      var modifiedUrl = window.location.href +`.json`;
    }else{
        var modifiedUrl = '/collections/all/products.json?limit=500';   
    }   
    $('.mss_product').hide();
    $('.mss_product span').html('');
   var arr=[];
  fetch(modifiedUrl)
    .then(response => response.json())
    .then(data => {          
       if (document.body.classList.contains('template-product')) {    
           if (expectedCodesArray.includes(enteredValue)) {       
              if(data.product.tags.includes('Kolkata')){                 
                   var elements = document.querySelectorAll('.product-item.' + data.product.tags);
                       document.querySelectorAll('.product-item').forEach(function(element) {
                        element.classList.add('code-deactive');
                      });  
                      elements.forEach(function(element) {
                         element.classList.remove('code-deactive');
                        element.classList.add('code-active');
                      });                               
                      if (elements.length === 0 && data.product.tags){                    
                        var singleElement = document.querySelector('.product-item.' + data.product.tags);
                        if (singleElement) {
                           singleElement.classList.remove('code-deactive');
                          singleElement.classList.add('code-active');
                        }
                      }             
                      localStorage.setItem("Zipcode", enteredValue);      
                     if(enteredValue !== ''){
                      var pincodeElement = document.querySelectorAll('.pincode');
                      for(var i=0;i<pincodeElement.length;i++){
                        pincodeElement[i].innerHTML = '';
                        pincodeElement[i].innerHTML += enteredValue;                    
                      }                
                    }                   
              }else{
                window.location.href = "/";
                localStorage.setItem("Zipcode", enteredValue);      
              } 
           if(get_data_url){
              var expectedurlArray = get_data_url.split(',');
                expectedurlArray.forEach(function(element) {
                $('.menu-link[href="'+ element +'"]').closest('li').show();
              });
          }  
        }else{
        if(get_data_url){
            var expectedurlArray = get_data_url.split(',');
            expectedurlArray.forEach(function(element) {
            $('.menu-link[href="'+ element +'"]').closest('li').hide();
            });
          }             
          if (data.product.tags.includes('Kolkata')) {
            window.location.href = "/";
            localStorage.setItem("Zipcode", enteredValue); 
          }else{
          console.log('code is not matched')
           var elements = document.querySelectorAll('.product-item.no_tag');
           document.querySelectorAll('.product-item').forEach(function(element) {
              element.classList.add('code-deactive');
            });  
           elements.forEach(function(element) {
               element.classList.remove('code-deactive');
              element.classList.add('code-active');
            });
            document.querySelector('.product-item.no_tag').add('code-active');
            document.querySelector('.product-item.' + product.tags).add('code-deactive');
           localStorage.setItem("Zipcode", enteredValue);
          }
        }
       }else{                
        data.products.forEach(product => {                  
        if (expectedCodesArray.includes(enteredValue)) {              
            if (!document.body.classList.contains('template-index')) {              
              if(product.tags.indexOf('Kolkata') > -1){                   
                       var elements = document.querySelectorAll('.product-item.Kolkata');
                       document.querySelectorAll('.product-item').forEach(function(element) {
                        element.classList.add('code-deactive');
                      });  
                      elements.forEach(function(element) {
                         element.classList.remove('code-deactive');
                        element.classList.add('code-active');
                      });                               
                      if (elements.length === 0 && product.tags){                    
                        var singleElement = document.querySelector('.product-item.Kolkata');
                        if (singleElement) {                      
                           singleElement.classList.remove('code-deactive');
                          singleElement.classList.add('code-active');
                        }
                      }
                  if(enteredValue !== null ){
                        localStorage.setItem("Zipcode", enteredValue);      
                  }            
              }
            }else{
              if(product.tags == 'PAN India'){                
                var elements = document.querySelectorAll('.feature_collection  .product-item.pan_code');                  
                elements.forEach(function(element) {
                   element.classList.remove('code-deactive');
                  element.classList.add('code-active');
                });                               
                if (elements.length === 0 && product.tags){                    
                  var singleElement = document.querySelector('.feature_collection  .product-item.pan_code');
                  if (singleElement) {                      
                     singleElement.classList.remove('code-deactive');
                    singleElement.classList.add('code-active');
                  }
                }
              }
              if(enteredValue !== null ){
                localStorage.setItem("Zipcode", enteredValue);      
              }
            }
          if(get_data_url){
            var expectedurlArray = get_data_url.split(',');
            expectedurlArray.forEach(function(element) {              
              $('.menu-link[href="'+ element +'"]').closest('li').show();
            });
          }
          
        }else{          
            if(get_data_url){
              var expectedurlArray = get_data_url.split(',');
              expectedurlArray.forEach(function(element) {              
              $('.menu-link[href="'+ element +'"]').closest('li').hide();
              });
            }
            console.log('code is not matched')
             var elements = document.querySelectorAll('.product-item.no_tag');
             document.querySelectorAll('.product-item').forEach(function(element) {
                element.classList.add('code-deactive');
              });  
             elements.forEach(function(element) {
                 element.classList.remove('code-deactive');
                element.classList.add('code-active');
              });              
            if(enteredValue !== null ){
             localStorage.setItem("Zipcode", enteredValue);
            }
          }
      });       
        
       if(enteredValue !== null ){
           var get_class = document.querySelectorAll('.code-active').length;
           console.log(get_class,'get_classget_class');
               if(enteredValue !== ''){
                var pincodeElement = document.querySelectorAll('.pincode');
                for(var i=0;i<pincodeElement.length;i++){
                  pincodeElement[i].innerHTML = '';
                  pincodeElement[i].innerHTML += enteredValue;                    
                }                
              }
             if (document.body.classList.contains('template-collection')) {  
                var CollectionProductCount =  document.querySelector('#CollectionProductCount');
                CollectionProductCount.innerHTML = '';
                CollectionProductCount.innerHTML += get_class +' products'; 
              document.querySelector('#CollectionProductCount').innerHTML += get_class +' products';
             }
          }
         if (document.body.classList.contains('template-search')) {
            if(get_data_search_product){
              var expectedurlArrayhand= get_data_search_product.split(',');
              expectedurlArrayhand.forEach(function(element) {              
                $('.template-search .product-item[data-handle="'+ element +'"]').attr('style','display:none !important;');                
            });
              
           }   
         }                  
       }
      function Get_pin(TagName){        
         elements.forEach(function(element,i) {
           if(!element.classList.contains('all_pro')){
            // var remove_id = element.getAttribute('data-id');
            // var remove_title = element.getAttribute('data-title'),get_loop=i;            
            //  arr.push(remove_title);
            //  console.log(arr,'===0000===');
            //  setCookie('remove_product',arr);  
            var remove_id = element.getAttribute('data-id');
            var remove_title = element.getAttribute('data-title'), get_loop = i;                        
            var currentItem = { title: remove_title };          
            arr.push(currentItem);
            var arrString = JSON.stringify(arr);
            setCookie('remove_product', arrString);
             
            $.ajax({
            type: 'POST',
            url: '/cart/change.js',                      
            data: {id:remove_id,quantity: 0},            
            dataType: 'json',
            async: false,
            error: function(jqXHR, textStatus, errorThrown){
              var response = $.parseJSON(jqXHR.responseText);
              console.log(response.description);              
            },
            success: function(data){
              console.log('successssss');
                console.log(elements.length,'code is in cart',remove_title);              
              $.get("?section_id=helper-cart", function( data ) {
              const sectionInnerHTML = new DOMParser().parseFromString(data, 'text/html');
              const cartFormInnerHTML = sectionInnerHTML.getElementById('AjaxCartForm').innerHTML;
              const cartSubtotalInnerHTML = sectionInnerHTML.getElementById('AjaxCartSubtotal').innerHTML;

              const cartItems = document.getElementById('AjaxCartForm');
              cartItems.innerHTML = cartFormInnerHTML;
              // cartItems.ajaxifyCartItems();

              document.querySelectorAll('[data-header-cart-count]').forEach(elm=>{
                  elm.textContent = cartItems.querySelector('[data-cart-count]').textContent;
              });
              document.querySelectorAll('[data-header-cart-total').forEach(elm=>{
                  elm.textContent = cartItems.querySelector('[data-cart-total]').textContent;
              });            

              document.getElementById('AjaxCartSubtotal').innerHTML = cartSubtotalInnerHTML;
              });
             
              if (typeof shipUpdate != "undefined") {                
                shipUpdate();
              }
              setTimeout(function() {
                if (typeof MainCode != "undefined") {
                  MainCode(csJq)
                }
              }, 1500);
              
            }              
          });
          }
          }); 
        setTimeout(()=>{
          var get_cookie = getCookie('remove_product');
          if (get_cookie) {
              var products = JSON.parse(get_cookie);        
              if (products.length > 0 && document.querySelectorAll('.cart-item').length > 0) {
                  var $mssProductSpan = $('.mss_product span');
                  $mssProductSpan.empty();
                  $mssProductSpan.append('Affected items:<br>');
                  for (var i = 0; i < products.length; i++) {
                    var capitalizedTitle = capitalizeFirstLetter(products[i].title);
                    $mssProductSpan.append((i + 1) + '. ' + capitalizedTitle + '<br>');                  
                  }        
                  $('.mss_product').show();
              } else {
                  $('.mss_product').hide();
              }
          } else {
              $('.mss_product').hide();
          }
        }, 500);

      }
      if(document.querySelectorAll('.cart-item').length > 0){
       if (expectedCodesArray.includes(enteredValue)) {                     
          console.log('entered in kolkata');
          var elements = document.querySelectorAll('.cart-item.no_tag');         
          Get_pin(elements);         
       }else{
         console.log('entered in pan');
         var elements = document.querySelectorAll('.cart-item.Kolkata');
         Get_pin(elements);
       }
      }
    })
    .catch(error => console.error('Error fetching data:', error));      
}


  document.addEventListener("DOMContentLoaded", function() {
  var content = document.querySelector(".toggle-button");
  var storedValue = localStorage.getItem("Zipcode");
  var outputElement = document.querySelector('.zip_input');    
  if(storedValue !== null){
    outputElement.value = storedValue;
  }
  
  if (storedValue) {
    zipcode(storedValue);  
    content.classList.remove('active');
    content.classList.remove('modal-code');
    document.body.classList.remove("modal-opened");
  }else{
    
  }  
    
  // add class in body
  if (content.classList.contains("modal-code")) {
      document.body.classList.add("modal-opened");
      content.classList.add('active');    
  }
});
$(document).ready(function(){
  var get_cookie = getCookie('remove_product');
  if (get_cookie) {
      var products = JSON.parse(get_cookie);  
      if (products.length > 0 && document.querySelectorAll('.cart-item').length > 0) {
          var $mssProductSpan = $('.mss_product span');
          $mssProductSpan.empty();
          $mssProductSpan.append('Affected items:<br>');
          for (var i = 0; i < products.length; i++) {
            var capitalizedTitle = capitalizeFirstLetter(products[i].title);
            $mssProductSpan.append((i + 1) + '. ' + capitalizedTitle + '<br>');
          }  
          $('.mss_product').show();
      } else {
          $('.mss_product').hide();
      }
  } else {
      $('.mss_product').hide();
  }

  //close the message
  $('.close-icon').on('click', function () {
    $('.mss_product').hide();
    setCookie('remove_product', '', { expires: -1 });
  });    
})