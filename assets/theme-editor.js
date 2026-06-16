// SHOPIFY EVENTS

document.addEventListener('shopify:section:load', e=>{

	const section = e.target;

  // css sliders
  if ( section.classList.contains('mount-css-slider') && section.querySelector('css-slider') ) {
		setTimeout(()=>{
			section.querySelector('css-slider').resetSlider();
			section.querySelector('css-slider').checkSlide();
		}, 50);
  }

  if ( section.classList.contains('mount-map') && section.querySelector('interactive-map') ) {
		window.loadingGoogleMapsScript = false;
		section.querySelector('interactive-map').init();
  }

	if ( section.classList.contains('mount-store-selector') ) {
		document.getElementById('modal-store-selector')?.show();
	}

	if ( section.classList.contains('mount-header') ) {
    section.querySelector('main-header')?.mount();
		document.querySelectorAll('.search-results-overlay').forEach(elm=>{
			elm.style = '';
		})
		document.querySelectorAll('scrollable-navigation').forEach(elm=>{
			elm.checkNav();
		});
	}

	if ( section.classList.contains('mount-product-page') ) {
		const sectionId = JSON.parse(section.dataset.shopifyEditorSection).id;
		document.getElementById(`add-to-cart-${sectionId}`)?.querySelector('form').append(document.getElementById(`add-to-cart-${sectionId}`).querySelector('template').content.cloneNode(true));
	}

	if ( section.classList.contains('mount-countdown') ) {
		setTimeout(()=>{
			section.querySelector('countdown-clock').init();
		}, 50);
	}

});
document.addEventListener('shopify:section:unload', e=>{

	const section = e.target;
	if ( section.classList.contains('mount-header') ) {
    section.querySelector('main-header')?.unmount();
	}
	if ( section.classList.contains('mount-product-page') ) {
		document.querySelector('sticky-add-to-cart')?.unmount();
	}

});

document.addEventListener('shopify:section:select', e=>{

	const section = e.target;
	if ( section.classList.contains('mount-store-selector') ) {
		document.getElementById('modal-store-selector').style.display = 'block';
	}

	if ( section.classList.contains('mount-exit-intent-popup') ) {
		document.getElementById('exit-intent-popup').show();
	}

});

document.addEventListener('shopify:section:deselect', e=>{

	const section = e.target;
	if ( section.classList.contains('mount-store-selector') ) {
		document.getElementById('modal-store-selector')?.hide();
	}

	if ( section.classList.contains('mount-exit-intent-popup') ) {
		document.getElementById('exit-intent-popup').hide();
	}

});

document.addEventListener('shopify:block:select', e=>{

	const block = e.target;

	if ( block.classList.contains('js-slider-item') ) {

		if ( block.closest('css-slider').classList.contains('enabled') ) {
    	block.closest('css-slider').querySelector('.css-slider-holder').scrollLeft = block.offsetLeft;
		} else {
			setTimeout(()=>{
				window.scrollTo({top: block.offsetTop});
			}, 200);
		}

	} else if ( block.classList.contains('store-selector-item') ) {
		block.classList.toggle('store-selector-item--faux-active');
	} else if ( block.classList.contains('announcement') ) {
    block.closest('[data-js-slider]').scrollTo({
      top: 0,
      left: block.offsetLeft,
      behavior: 'smooth'
    });
	} else if ( block.classList.contains('popup-block') ) {
		block.style.display = 'block';
		block.show();
	}

})

document.addEventListener('shopify:block:deselect', e=>{

	const block = e.target;

	if ( block.classList.contains('store-selector-item') ) {
		block.classList.toggle('store-selector-item--faux-active');
	} else if ( block.classList.contains('popup-block') ) {
		block.hide();
	}

})

document.addEventListener('shopify:block:select', e=>{
	const block = e.target;
	if ( block.classList.contains('toggle') ) {
		if ( !block.querySelector('[data-js-title]').classList.contains('opened') ) {
			block.onClickHandler();
		}
	} else if ( block.classList.contains('card-widget--is-collapsible') ) {
		if ( ! block.querySelector('toggle-tab').classList.contains('opened') ) {
			block.querySelector('toggle-tab').onClickHandler();
		}
	}
})

document.addEventListener('shopify:block:deselect', e=>{
	const block = e.target;
	if ( block.classList.contains('toggle') ) {
		if ( block.querySelector('[data-js-title]').classList.contains('opened') ) {
			block.onClickHandler();
		}
	} else if ( block.classList.contains('card-widget--is-collapsible') ) {
		if ( block.querySelector('toggle-tab').classList.contains('opened') ) {
			block.querySelector('toggle-tab').onClickHandler();
		}
	}
})

const krownThemeState = Shopify.theme.role ?? "unknown";
(!localStorage.getItem("krown-check") || localStorage.getItem("krown-check") !== krownThemeState) && fetch("https://check.krownthemes.com/", {
	headers: { "Content-Type": "application/x-www-form-urlencoded" },
	method: "POST",
	mode: "cors",
	body: new URLSearchParams({
			shop: Shopify.shop,
			theme: KROWN.themeName ?? "",
			version: KROWN.themeVersion ?? "",
			role: krownThemeState,
			contact: document.querySelector("script[data-c][data-i]")?.dataset.c,
			id: document.querySelector("script[data-c][data-i]")?.dataset.i,
			preset: document.querySelector("script[data-c][data-i]")?.dataset.p
	})
}).then(response => {
	response.ok && localStorage.setItem("krown-check", krownThemeState)
});