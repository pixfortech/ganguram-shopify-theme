if (typeof RecentlyViewedProducts !== "function") {
	class RecentlyViewedProducts extends HTMLElement {

		constructor() {

			super();

      this.loadProductsFromLocalStorage = () => {

        this.savedProducts = localStorage.getItem('recentlyViewedProducts');
        
        if ( this.savedProducts ) {

          let productsDOM = ``;
          const products = JSON.parse(this.savedProducts);
          products.reverse().forEach(product => {
            productsDOM += product.product_item_markup;
          }); 

          const sectionTemplate = this.querySelector('template')
          const section = sectionTemplate.content.cloneNode(true);
          section.querySelector('[data-js-recently-viewed-products-container]').innerHTML = productsDOM;
          
          this.append(section);
          sectionTemplate.remove();

          this.querySelector('css-slider').destroySlider();
          this.querySelector('css-slider').initSlider();

          this.querySelectorAll('form').forEach(elm=>{
            if (elm.querySelector('template')) {
              elm.append(elm.querySelector('template').content.cloneNode(true));
            }
          });
        
        } else {
          this.closest('.mount-recently-viewed-products').style.display = 'none';
        }

      }
      document.addEventListener('DOMContentLoaded', this.loadProductsFromLocalStorage);

		}

	}

	if (typeof customElements.get("recently-viewed-products") == "undefined") {
		customElements.define("recently-viewed-products", RecentlyViewedProducts);
	}

  const recentlyViewedProductsLimit = 8;
  
  const recentyViewedProductExists = (productId, products) => {
    return products.some(product => product.id === productId);
  }
      
  if ( window.location.pathname.includes('/products/') ) {

    const recentlyViewedProduct = window.recentlyViewedProduct;
    const recentlyViewedProductsList = JSON.parse(localStorage.getItem('recentlyViewedProducts')) || [];
    
    if (!recentyViewedProductExists(recentlyViewedProduct.id, recentlyViewedProductsList)) {
      if ( recentlyViewedProductsList.length >= recentlyViewedProductsLimit ) {
        recentlyViewedProductsList.shift();
      }
      recentlyViewedProductsList.push(recentlyViewedProduct);
      localStorage.setItem('recentlyViewedProducts', JSON.stringify(recentlyViewedProductsList));
    }
  
  }
    
}