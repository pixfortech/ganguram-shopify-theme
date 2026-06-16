if (typeof TermsAndConditionsToggle !== 'function') {

  class TermsAndConditionsToggle extends HTMLElement {
    constructor() {
      super();

      this.checkbox = this.querySelector('#AgreeToTos');

      if (this.checkbox) {
        this.toggleCheckoutButton();

        this.checkbox.addEventListener('change', () => {
          this.toggleCheckoutButton();
        });
      }
    }

    toggleCheckoutButton() {
      document.querySelectorAll('#CheckOut').forEach(button => {
        button.disabled = !this.checkbox.checked;
      });
    }
  }

  if (typeof customElements.get('terms-checkbox') === 'undefined') {
    customElements.define('terms-checkbox', TermsAndConditionsToggle);
  }

}