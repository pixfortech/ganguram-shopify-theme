(() => {
  if (customElements.get('ganguram-gift-box')) return;
  class GanguramGiftBox extends HTMLElement {
    connectedCallback() {
      if (this.ready) return;
      this.ready = true;
      this.progress = 0;
      this.target = 0;
      this.lid = this.querySelector('.ggb-lid');
      this.flap = this.querySelector('.ggb-flap');
      this.shade = this.querySelector('.ggb-shade');
      this.button = this.querySelector('.ggb-toggle');
      this.label = this.querySelector('[data-ggb-label]');
      this.status = this.querySelector('.ggb-status');
      if (!this.lid || !this.button) return;
      this.toggle = event => { event.preventDefault(); event.stopPropagation(); this.animateTo(this.target ? 0 : 1); };
      this.button.addEventListener('click', this.toggle);
      const images = [...this.querySelectorAll('.ggb-scene img')];
      Promise.all(images.map(img => img.decode())).then(() => {
        if (!this.isConnected) return;
        this.button.disabled = false;
        this.status.textContent = 'A little anticipation. A lovely reveal.';
      }).catch(() => {
        this.status.textContent = 'The image could not load. Please refresh to try again.';
      });
      this.render(0);
    }
    disconnectedCallback() {
      cancelAnimationFrame(this.frame);
      this.button?.removeEventListener('click', this.toggle);
      this.ready = false;
    }
    render(value) {
      this.progress = value;
      // Release the magnetic flap before the rigid lid lifts. Closing reverses the sequence.
      const release = Math.min(1, value / .14);
      const lift = Math.max(0, Math.min(1, (value - .1) / .9));
      const angle = lift * 99;
      this.lid.style.transform = `rotateX(${angle}deg)`;
      this.flap.style.transform = `rotateX(${-90 + release * 90}deg)`;
      this.shade.style.opacity = String(.22 * (1 - lift));
      this.shade.style.transform = `scaleY(${1 - lift * .8})`;
      this.dataset.progress = value.toFixed(3);
    }
    animateTo(target) {
      cancelAnimationFrame(this.frame);
      this.target = target;
      this.button.setAttribute('aria-expanded', String(Boolean(target)));
      this.label.textContent = target ? 'Close box' : 'Open box';
      this.button.setAttribute('aria-label', this.label.textContent);
      const start = this.progress;
      const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2200 * Math.abs(target - start);
      const began = performance.now();
      this.status.textContent = target ? 'Opening your gift…' : 'Closing your gift…';
      const tick = now => {
        const t = duration ? Math.min(1, (now - began) / duration) : 1;
        const ease = t * t * (3 - 2 * t);
        this.render(start + (target - start) * ease);
        if (t < 1) this.frame = requestAnimationFrame(tick);
        else this.status.textContent = target ? 'A box full of little celebrations.' : 'A little anticipation. A lovely reveal.';
      };
      this.frame = requestAnimationFrame(tick);
    }
  }
  customElements.define('ganguram-gift-box', GanguramGiftBox);
})();
