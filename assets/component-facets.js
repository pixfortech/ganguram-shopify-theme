// Range Slider - https://www.cssscript.com/custom-range-slider-input/

!function(e,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define([],t):"object"==typeof exports?exports.rangeSlider=t():e.rangeSlider=t()}(this,(()=>{return e={138:e=>{e.exports=(e,t={})=>{const a=e=>!isNaN(e)&&+e+""==e+"",i=(e=0,t=0)=>({min:e,max:t}),n=e=>{[k,F].forEach(e)},m=(e,t,a)=>{if(e)return t;a()},s=(e,t,a="")=>{e.setAttribute(t,a)},l=(e,t)=>{e.removeAttribute(t)},r=(e,t,a,i=!0)=>{e.addEventListener(t,a,i?{passive:!1,capture:!0}:{})},d=(e,t,a,i=!0)=>{e.removeEventListener(t,a,i?{passive:!1,capture:!0}:{})},o=(e,a)=>{t[e]={}.hasOwnProperty.call(t,e)?t[e]:a},u=(e,a)=>t.orientation===H?e:a,b=e=>1===e?Q.max:Q.min,x=()=>{let e=!1;a(t.min)&&a(t.max)||(e=!0),t.min=e?1:+t.min,t.max=e?1:+t.max},h=()=>{t.thumbsDisabled instanceof Array?(1===t.thumbsDisabled.length&&t.thumbsDisabled.push(!1),1!==t.thumbsDisabled.length&&2!==t.thumbsDisabled.length&&(t.thumbsDisabled=[!1,!1])):t.thumbsDisabled=[t.thumbsDisabled,t.thumbsDisabled],t.thumbsDisabled[0]=!!t.thumbsDisabled[0],t.thumbsDisabled[1]=!!t.thumbsDisabled[1]},p=(e,a=!1,n=!0,m=!0)=>{const r=i(le[Q.min].value,le[Q.max].value);e=e||r,le[Q.min].value=e.min,le[Q.max].value=ne||a?e.max:e.min+ae,g(),K.min>K.max&&(Q.min=+!Q.min,Q.max=+!Q.max,l(re[Q.min],V),l(re[Q.max],P),s(re[Q.min],P),s(re[Q.max],V),ne&&(ne=ne===k?F:k),g()),ee=a?K:e;let d=!1;(r.min!==le[Q.min].value||a)&&(d=!0),(r.max!==le[Q.max].value||a)&&(d=!0),d&&(n&&t.onInput&&t.onInput([K.min,K.max],m),E(),c(),D(),y())},g=()=>{n((e=>{K[e]=+le[Q[e]].value}))},c=()=>{n((e=>{re[Q[e]].style[u("top","left")]=`calc(${(K[e]-t.min)/te*100}% + ${(.5-(K[e]-t.min)/te)*u(W,U)[e]}px)`}))},D=()=>{const a=e.getBoundingClientRect(),i=(.5-(K.min-t.min)/te)*u(W,U).min/u(a.bottom-a.top,a.right-a.left),n=(.5-(K.max-t.min)/te)*u(W,U).max/u(a.bottom-a.top,a.right-a.left);se.style[u("top","left")]=100*((K.min-t.min)/te+i)+"%",se.style[u("height","width")]=100*((K.max-t.min)/te-(K.min-t.min)/te-i+n)+"%"},v=()=>{n(((e,a)=>{Z[e]=t.thumbsDisabled[a]?K[e]:t[e]}))},f=()=>{n(((e,a)=>{t.disabled||t.thumbsDisabled[a]?l(re[b(a)],O):s(re[b(a)],O,0)}))},y=()=>{n((e=>{s(re[Q[e]],"aria-valuemin",t.min),s(re[Q[e]],"aria-valuemax",t.max),s(re[Q[e]],"aria-valuenow",K[e]),s(re[Q[e]],"aria-valuetext",K[e])}))},w=()=>{t.disabled?s(e,J):l(e,J)},S=()=>{t.thumbsDisabled.forEach(((e,t)=>{const a=b(t);e?(s(re[a],J),s(re[a],"aria-disabled",!0)):(l(re[a],J),s(re[a],"aria-disabled",!1))}))},_=(e,a=!1)=>{t[e]=a,x(),n((e=>{le[0][e]=t[e],le[1][e]=t[e]})),te=t.max-t.min,p("",!0,!0,!1),v()},$=()=>{t.orientation===H?s(e,Y):l(e,Y),se.style[u("left","top")]="",se.style[u("width","height")]="",re[0].style[u("left","top")]="",re[1].style[u("left","top")]=""},E=()=>{n((e=>{U[e]=z(M(re[Q[e]]).width),W[e]=z(M(re[Q[e]]).height)}))},R=(a,i)=>{const n=e.getBoundingClientRect(),m=i.getBoundingClientRect(),s=(u(m.top-n.top,m.left-n.left)+(a[`client${u("Y","X")}`]-i.getBoundingClientRect()[u("top","left")])-(ne?(.5-(K[ne]-t.min)/te)*u(W,U)[ne]:0))/u(n.bottom-n.top,n.right-n.left)*te+t.min;return s<t.min?t.min:s>t.max?t.max:s},T=(e,t)=>!e.target.classList.contains(t),A=(e,a=!0)=>{let n=!1;if(!t.disabled&&(T(e,"range-slider__thumb")&&T(e,"range-slider__range")||t.rangeSlideDisabled&&T(e,"range-slider__thumb"))&&(n=!0),n&&t.thumbsDisabled[0]&&t.thumbsDisabled[1]&&(n=!1),n){const n=R(e,se),m=q(K.min-n),s=q(K.max-n);if(t.thumbsDisabled[0])n>=K.min&&(p(i(K.min,n),!0,!a),C(e,Q.max,re[Q.max],!a));else if(t.thumbsDisabled[1])n<=K.max&&(p(i(n,K.max),!0,!a),C(e,Q.min,re[Q.min],!a));else{let t=Q.max;m===s?p(i(K.min,n),!0,!a):(p(i(m<s?n:K.min,s<m?n:K.max),!0,!a),t=m<s?Q.min:Q.max),C(e,t,re[t],!a)}a&&A(e,!1)}},L=(e,t)=>{E(),s(t,X),me=R(e,t),ie=!0},C=(e,a,i,n=!0)=>{t.disabled||t.thumbsDisabled[b(a)]||(L(e,i),ne=Q.min===a?k:F,n&&t.onThumbDragStart&&t.onThumbDragStart())},B=e=>{if(ie){const a=R(e,se),n=a-me;let m=K.min,s=K.max;const l=ne?Z.min:t.min,r=ne?Z.max:t.max;ne&&ne!==k||(m=ne?a:ee.min+n),ne&&ne!==F||(s=ne?a:ee.max+n),m>=l&&m<=r&&s>=l&&s<=r?(p({min:m,max:s}),me=a):(m>r&&ne&&(p(i(r,r)),me=a),s<l&&ne&&(p(i(l,l)),me=a),m<l&&(p(i(l,ne?K.max:K.max-K.min+l)),me=a),s>r&&(p(i(ne?K.min:K.min-K.max+r,r)),me=a)),ne||v()}},I=()=>{ie&&(l(re[0],X),l(re[1],X),l(se,X),ie=!1,ne?t.onThumbDragEnd&&t.onThumbDragEnd():t.onRangeDragEnd&&t.onRangeDragEnd())},N=()=>{E(),c(),D()},j=()=>{const e=z(le[0].step);return le[0].step===G?G:0===e||isNaN(e)?1:e},q=Math.abs,z=parseFloat,M=window.getComputedStyle,k="min",F="max",G="any",H="vertical",O="tabindex",P="data-lower",V="data-upper",X="data-active",Y="data-vertical",J="data-disabled",K=i(),Q=i(0,1),U=i(),W=i(),Z=i();let ee=i(),te=0,ae=0,ie=!1,ne=!1,me=0;o("rangeSlideDisabled",!1),o("thumbsDisabled",[!1,!1]),o("orientation","horizontal"),o("disabled",!1),o("onThumbDragStart",!1),o("onRangeDragStart",!1),o("onThumbDragEnd",!1),o("onRangeDragEnd",!1),o("onInput",!1),o("value",[25,75]),o("step",1),o("min",0),o("max",100),x(),h(),e.innerHTML=`<input type="range" min="${t.min}" max="${t.max}" step="${t.step}" value="${t.value[0]}" disabled><input type="range" min="${t.min}" max="${t.max}" step="${t.step}" value="${t.value[1]}" disabled><div role="slider" class="range-slider__thumb" ${P}></div><div role="slider" class="range-slider__thumb" ${V}></div><div class="range-slider__range"></div>`,e.classList.add("range-slider");const se=e.querySelector(".range-slider__range"),le=e.querySelectorAll("input"),re=e.querySelectorAll(".range-slider__thumb");return te=t.max-t.min,p("",!0,!1),v(),w(),S(),f(),$(),r(e,"pointerdown",(e=>{A(e)})),Array.from(re).forEach(((e,a)=>{r(e,"pointerdown",(t=>{C(t,a,e)})),r(e,"keydown",(e=>{e.which>=37&&e.which<=40&&(e.preventDefault(),((e,a)=>{const i=(37===a||40===a?-1:1)*u(-1,1);if(!t.disabled&&!t.thumbsDisabled[b(e)]){let t=j();t=t===G?1:t;let a=K.min+t*(Q.min===e?i:0),n=K.max+t*(Q.max===e?i:0);a>Z.max&&(a=Z.max),n<Z.min&&(n=Z.min),p({min:a,max:n},!0)}})(a,e.which))}))})),r(se,"pointerdown",(e=>{(e=>{t.disabled||t.rangeSlideDisabled||(L(e,se),ae=K.max-K.min,ne=!1,t.onRangeDragStart&&t.onRangeDragStart())})(e)})),r(document,"pointermove",B),r(document,"pointerup",I),r(window,"resize",N),{min:(e=!1)=>m(!e&&0!==e,t.min,(()=>{_(k,e)})),max:(e=!1)=>m(!e&&0!==e,t.max,(()=>{_(F,e)})),step:(e=!1)=>m(!e,j(),(()=>{le[0].step=e,le[1].step=e,p("",!0,!0,!1)})),value:(e=!1)=>m(!e,[K.min,K.max],(()=>{p(i(e[0],e[1]),!0,!0,!1),v()})),orientation:(e=!1)=>m(!e,t.orientation,(()=>{t.orientation=e,$(),p("",!0,!0,!1)})),disabled:(e=!0)=>{t.disabled=!!e,w()},thumbsDisabled:(e=[!0,!0])=>{t.thumbsDisabled=e,h(),v(),f(),S()},rangeSlideDisabled:(e=!0)=>{t.rangeSlideDisabled=!!e},currentValueIndex:()=>ne?ne===k?0:1:-1,removeGlobalEventListeners:()=>{d(document,"pointermove",B),d(document,"pointerup",I),d(window,"resize",N)}}}}},t={},function a(i){var n=t[i];if(void 0!==n)return n.exports;var m=t[i]={exports:{}};return e[i](m,m.exports,a),m.exports}(138);var e,t}));

class FacetFiltersForm extends HTMLElement {

  static _prefix = window.KT_PREFIX || '';

  constructor() {

    super();


    this._prefix = FacetFiltersForm._prefix;
    this.onActiveFilterClick = this.onActiveFilterClick.bind(this);
    this.debouncedOnSubmit = debounce((event) => {
      this.onSubmitHandler(event);
    }, 500);

    const facetForm = this.querySelector('form');
    facetForm.addEventListener('input', this.debouncedOnSubmit.bind(this));

  }

  static setListeners() {
    const onHistoryChange = (event) => {
      const searchParams = event.state ? event.state.searchParams : FacetFiltersForm.searchParamsInitial;
      if (searchParams === FacetFiltersForm.searchParamsPrev) return;
      FacetFiltersForm.renderPage(searchParams, null, false);
    }
    window.addEventListener('popstate', onHistoryChange);
  }

  static toggleActiveFacets(disable = true) {
    document.querySelectorAll(`.${this._prefix}js-facet-remove`).forEach((element) => {
      element.classList.toggle(`${this._prefix}disabled`, disable);
    });
  }

  static renderPage(searchParams, event, updateURLHash = true) {
    FacetFiltersForm.searchParamsPrev = searchParams;
    const sections = FacetFiltersForm.getSections();
    document.getElementById('main-collection-product-grid').classList.add(`${this._prefix}loading`);
    sections.forEach((section) => {
      const url = `${window.location.pathname}?section_id=${section.section}&${searchParams}`;
      const filterDataUrl = element => element.url === url;
      FacetFiltersForm.filterData.some(filterDataUrl) ?
        FacetFiltersForm.renderSectionFromCache(filterDataUrl, event) :
        FacetFiltersForm.renderSectionFromFetch(url, event);
    });
    if (updateURLHash) FacetFiltersForm.updateURLHash(searchParams);
  }

  static renderSectionFromFetch(url, event) {
    fetch(url)
      .then(response => response.text())
      .then((responseText) => {
        const html = responseText;
        FacetFiltersForm.filterData = [...FacetFiltersForm.filterData, { html, url }];
        FacetFiltersForm.renderFilters(html, event);
        FacetFiltersForm.renderProductGrid(html);
        FacetFiltersForm.renderProductCount(html);
      });
  }

  static renderSectionFromCache(filterDataUrl, event) {
    const html = FacetFiltersForm.filterData.find(filterDataUrl).html;
    FacetFiltersForm.renderFilters(html, event);
    FacetFiltersForm.renderProductGrid(html);
    FacetFiltersForm.renderProductCount(html);
  }

  static renderProductGrid(html) {
    const innerHTML = new DOMParser()
      .parseFromString(html, 'text/html')
      .getElementById('CollectionProductGrid').innerHTML;
    document.getElementById('CollectionProductGrid').innerHTML = innerHTML;
    document.getElementById('CollectionProductGrid').querySelectorAll('template').forEach(elm=>{
      elm.closest('form')?.append(elm.content.cloneNode(true));
    })
    const event = new CustomEvent('krown:main-collection-grid:filtered', {
      bubbles: true,
      detail: {
        gridElement: document.getElementById('CollectionProductGrid')
      }
    });
    document.dispatchEvent(event);
  }

  static renderProductCount(html) {
    const countEl = new DOMParser().parseFromString(html, 'text/html').getElementById('CollectionProductCount');
    if ( countEl ) {
      document.querySelectorAll('#CollectionProductCount').forEach(elm=>{
        elm.innerHTML = countEl.innerHTML;
      });
    }
  }

  static renderFilters(html, event) {
    const parsedHTML = new DOMParser().parseFromString(html, 'text/html');

    const facetDetailsElementsFromFetch = parsedHTML.querySelectorAll(
      `#FacetFiltersForm .${this._prefix}js-filter, #FacetFiltersFormMobile .${this._prefix}js-filter`
    );
    const facetDetailsElementsFromDom = document.querySelectorAll(
      `#FacetFiltersForm .${this._prefix}js-filter, #FacetFiltersFormMobile .${this._prefix}js-filter`
    );
      
    // Remove facets that are no longer returned from the server
    Array.from(facetDetailsElementsFromDom).forEach((currentElement) => {
      if (!Array.from(facetDetailsElementsFromFetch).some(({ id }) => currentElement.id === id)) {
        currentElement.remove();
      }
    });

    const matchesId = (element) => {
      const jsFilter = event ? event.target.closest(`.${this._prefix}js-filter`) : undefined;
      return jsFilter ? element.id === jsFilter.id : false;
    };

    const facetsToRender = Array.from(facetDetailsElementsFromFetch).filter((element) => !matchesId(element));
    const countsToRender = Array.from(facetDetailsElementsFromFetch).find(matchesId);

    facetsToRender.forEach((elementToRender, index) => {
      const currentElement = document.getElementById(elementToRender.id);
      if (currentElement) {
        document.getElementById(elementToRender.id).innerHTML = elementToRender.innerHTML;
      } else {
        if (index > 0) {
          const { className: previousElementClassName, id: previousElementId } = facetsToRender[index - 1];
          if (elementToRender.className === previousElementClassName) {
            document.getElementById(previousElementId).after(elementToRender);
            return;
          }
        }

        if (elementToRender.parentElement) {
          document.querySelector(`#${elementToRender.parentElement.id} .${this._prefix}js-filter`).before(elementToRender);
        }
      }
    });

    FacetFiltersForm.renderActiveFacets(parsedHTML);

    if (countsToRender) FacetFiltersForm.renderCounts(countsToRender, event.target.closest(`.${this._prefix}js-filter`));
    
  }

  static renderActiveFacets(html) {
    const activeFacetElementSelectors = [`.${this._prefix}active-facets-mobile`, `.${this._prefix}active-facets-desktop`];
    activeFacetElementSelectors.forEach((selector) => {
      const activeFacetsElement = html.querySelector(selector);
      if (!activeFacetsElement) return;
      if ( document.querySelector(selector) ) {
        document.querySelector(selector).innerHTML = activeFacetsElement.innerHTML;
      }
    })

    FacetFiltersForm.toggleActiveFacets(false);

  }

  static renderCounts(source, target) {
    const countElementSelectors = [`.${this._prefix}facets__selected`];
    countElementSelectors.forEach((selector) => {
      const targetElement = target.querySelector(selector);
      const sourceElement = source.querySelector(selector);
      if (sourceElement && targetElement) {
        target.querySelector(selector).outerHTML = source.querySelector(selector).outerHTML;
      }
    });
  }

  static updateURLHash(searchParams) {
    history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
  }

  static getSections() {
    return [
      {
        id: 'main-collection-product-grid',
        section: document.getElementById('main-collection-product-grid').dataset.id,
      }
    ]
  }
  
  createSearchParams(form) {
    const formData = new FormData(form);
    return new URLSearchParams(formData).toString();
  }

  onSubmitForm(searchParams, event) {
    FacetFiltersForm.renderPage(searchParams, event);
  }

  onSubmitHandler(event) {
    event.preventDefault();
    const sortFilterForms = document.querySelectorAll('facet-filters-form form');
    const forms = [];
    const isMobile = event.target.closest('form').id === 'FacetFiltersFormMobile';

    sortFilterForms.forEach((form) => {
      if (!isMobile) {
        if (form.id === 'FacetSortForm' || form.id === 'FacetFiltersForm' || form.id === 'FacetSortDrawerForm') {
          const noJsElements = document.querySelectorAll(`.${this._prefix}no-js-list`);
          noJsElements.forEach((el) => el.remove());
          forms.push(this.createSearchParams(form));
        }
      } else if (form.id === 'FacetFiltersFormMobile') {
        forms.push(this.createSearchParams(form));
      }
    });
    this.onSubmitForm(forms.join('&'), event);
  }

  onActiveFilterClick(event) {
    event.preventDefault();
    FacetFiltersForm.toggleActiveFacets();
    const url = event.currentTarget.href.indexOf('?') == -1 ? '' : event.currentTarget.href.slice(event.currentTarget.href.indexOf('?') + 1);
    FacetFiltersForm.renderPage(url);
  }

}

FacetFiltersForm.filterData = [];
FacetFiltersForm.searchParamsInitial = window.location.search.slice(1);
FacetFiltersForm.searchParamsPrev = window.location.search.slice(1);
customElements.define('facet-filters-form', FacetFiltersForm);
FacetFiltersForm.setListeners();
class FacetRemove extends HTMLElement {
  constructor() {
    super();
    const facetLink = this.querySelector('a');
    facetLink.setAttribute('role', 'button');
    facetLink.addEventListener('click', this.closeFilter.bind(this));
    facetLink.addEventListener('keyup', (event) => {
      event.preventDefault();
      if (event.code.toUpperCase() === 'SPACE') this.closeFilter(event);
    });
  }
  closeFilter(event) {
    event.preventDefault();
    const form = this.closest('facet-filters-form') || document.querySelector('facet-filters-form');
    form.onActiveFilterClick(event);
  }
}

customElements.define('facet-remove', FacetRemove);
class PriceRange extends HTMLElement {

  constructor() {
    super();
    this.querySelectorAll('input')
      .forEach(element => {
        element.addEventListener('change', this.onRangeChange.bind(this));
        element.addEventListener('input', this.maxCheck.bind(this));
      });

    this.setMinAndMaxValues();
    
    //const usesComma = Boolean(this.getAttribute('data-uses-comma'));
    const inputMin = this.querySelector('input[name="filter.v.price.gte"]');
    const inputMax = this.querySelector('input[name="filter.v.price.lte"]');
    let inputTimer = null;
    let isSyncingFromInput = false;

    if ( this.parentElement.querySelector('[data-js-price-range-slider]') ) {
      setTimeout(()=>{
        const rangeSliderElm = this.parentElement.querySelector('[data-js-price-range-slider]');
        const sliderApi = rangeSlider(rangeSliderElm, {
          min: Number(inputMin.getAttribute('min')),
          max: Number(inputMax.getAttribute('max')),
          value: [inputMin.value || Number(inputMin.getAttribute('placeholder')), inputMax.value || Number(inputMax.getAttribute('placeholder'))],
          onInput: values => {
            if (isSyncingFromInput) {
              return;
            }
            inputMin.value = `${values[0]}`;
            inputMax.value = `${values[1]}`;
            clearTimeout(inputTimer);

            inputTimer = setTimeout(()=>{
              document.querySelector(`facet-filters-form[data-location="${rangeSliderElm.id.includes('desktop') ? 'desktop' : 'mobile'}"]`).onSubmitHandler({
                target: inputMin,
                preventDefault: ()=>{return;}
              });
              document.querySelector(`facet-filters-form[data-location="${rangeSliderElm.id.includes('desktop') ? 'desktop' : 'mobile'}"]`).onSubmitHandler({
                target: inputMax,
                preventDefault: ()=>{return;}
              });
              this.onRangeChange({
                currentTarget: inputMin
              });
              this.onRangeChange({
                currentTarget: inputMax
              });
            }, 500);
          }
        });

        const syncSliderFromInput = (evt) => {
          if (!sliderApi) {
            return;
          }
          const minVal = Number(inputMin.value || inputMin.getAttribute('placeholder') || inputMin.getAttribute('min'));
          const maxVal = Number(inputMax.value || inputMax.getAttribute('placeholder') || inputMax.getAttribute('max'));

          isSyncingFromInput = true;
          sliderApi.value([minVal, maxVal]);
          isSyncingFromInput = false;
        };
        inputMin.addEventListener('input', syncSliderFromInput);
        inputMax.addEventListener('input', syncSliderFromInput);
      }, 500);
    }

  }

  onRangeChange(event) {
    this.adjustToValidValues(event.currentTarget);
    this.setMinAndMaxValues();
  }

  setMinAndMaxValues() {
    const inputs = this.querySelectorAll('input');
    const minInput = inputs[0];
    const maxInput = inputs[1];
    if (maxInput.value) minInput.setAttribute('max', maxInput.value);
    if (minInput.value) maxInput.setAttribute('min', minInput.value);
    if (minInput.value === '') maxInput.setAttribute('min', 0);
    if (maxInput.value === '') minInput.setAttribute('max', maxInput.getAttribute('max'));
  }

  adjustToValidValues(input) {
    const value = Number(input.value);
    const min = Number(input.getAttribute('min'));
    const max = Number(input.getAttribute('max'));

    if (value < min) input.value = min;
    if (value > max) input.value = max;
  }

  maxCheck(object) {
    let max = parseInt(object.target.max);
    let value = parseInt(object.target.value);

    if (value > max) {
      object.target.value = max
    }
  } 
}

customElements.define('price-range', PriceRange);