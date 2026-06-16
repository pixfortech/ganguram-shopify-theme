if ( typeof SearchForm !== 'function' ) {
	class SearchForm extends HTMLElement {

		constructor() {

			super();	
			this.cachedResults = {};
			this.input = this.querySelector('[data-js-search-input]');
			this.predictiveSearchResults = this.querySelector('[data-js-search-results]');
			this.results = [];
			this.preloader = false;

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

		getSearchResults(query="") {

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
					const results = new DOMParser().parseFromString(text, 'text/html').querySelector('#shopify-section-helper-predictive-search').innerHTML;
					this.cachedResults[queryKey] = results;
					this.renderSearchResults(results);
                    var get_data_url = document.querySelector('.custom-pincode-button').getAttribute('data-code-url'); 
                    var get_data_search_product = document.querySelector('.custom-pincode-button').getAttribute('data-search-handle'); 
                    var modifiedUrl = '/collections/all/products.json?limit=500';  
                    var expectedValue = document.querySelector('.custom-pincode-button').getAttribute('data-code-list');
                    var expectedCodesArray = expectedValue.split(',');
                    var enteredValue = document.querySelector('.zip_input').value;
                    fetch(modifiedUrl)
                    .then(response => response.json())
                    .then(data => {
                       data.products.forEach(product => {        
                  if (expectedCodesArray.includes(enteredValue)) {                   
                          if(product.tags == 'Kolkata'){                                         
                                   var elements = document.querySelectorAll('.search-item.' + product.tags);                          
                                  document.querySelectorAll('.search-item').forEach(function(element) {
                                    element.classList.add('code-deactive');
                                  });
                                  elements.forEach(function(element) {
                                     element.classList.remove('code-deactive');
                                    element.classList.add('code-active');
                                  });                               
                                  if (elements.length === 0 && product.tags){                    
                                    var singleElement = document.querySelector('.search-item.' + product.tags);
                                    if (singleElement) {                      
                                       singleElement.classList.remove('code-deactive');
                                      singleElement.classList.add('code-active');
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
               var elements = document.querySelectorAll('.search-item.no_tag');
               document.querySelectorAll('.search-item').forEach(function(element) {
                  element.classList.add('code-deactive');
                });  
               elements.forEach(function(element) {
                   element.classList.remove('code-deactive');
                  element.classList.add('code-active');
                });
                // document.querySelector('.search-item.no_tag').add('code-active');
                // document.querySelector('.search-item.' + product.tags).add('code-deactive');
              if(enteredValue !== null ){
               localStorage.setItem("Zipcode", enteredValue);
              }
           }
      });       
        
                   if(enteredValue !== null ){
                       var get_class = document.querySelectorAll('.code-active').length;                       
                           if(enteredValue !== ''){
                            var pincodeElement = document.querySelectorAll('.pincode');
                            for(var i=0;i<pincodeElement.length;i++){
                              pincodeElement[i].innerHTML = '';
                              pincodeElement[i].innerHTML += enteredValue;                    
                            }                
                          }             
                      }                              
                    })
                  
				})	
				.catch((e) => {
					throw e;
				}); 

		}

		clearSearchResults(){
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
			this.predictiveSearchResults.innerHTML = results;
			this.preloader = false;
			this.results = this.predictiveSearchResults.querySelectorAll('[data-js-search-item]');
		}

		navigateThrough(direction){

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
				document.querySelector('[data-js-search-results-holder]').scrollTop = this.results[this.a11yIndex].offsetTop - 200;
			} else {
				document.querySelector('[data-js-search-results-holder]').scrollTop = 0;
			}

		}

	}

  if ( typeof customElements.get('search-form') == 'undefined' ) {
		customElements.define('search-form', SearchForm);
	}

}