'use strict';

const CATEGORY_EMOJI = {
  'Educational':  '🧠',
  'Creative':     '🎨',
  'Outdoor':      '🌳',
  'Building':     '🧱',
  'Pretend Play': '🎭',
  'Tech':         '🤖',
  'Games':        '🎲',
};

class WunderApp {
  constructor() {
    // Form state
    this.age = 2;
    this.gender = 'all';
    this.interests = [];
    this.budget = { min: 0, max: 9999 };
    this.description = '';

    // Results state
    this.allResults = [];
    this.wishlist = this._loadWishlist();

    // Debounce guard
    this._submitting = false;

    this._initElements();
    this._bindEvents();
    this._updateWishlistBadge();
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  _initElements() {
    this.ageSlider   = document.getElementById('age-slider');
    this.ageDisplay  = document.getElementById('age-display');
    this.submitBtn   = document.getElementById('submit-btn');
    this.descTextarea= document.getElementById('description');
    this.charCount   = document.getElementById('char-count');

    this.resultsSection = document.getElementById('results-section');
    this.loadingState   = document.getElementById('loading-state');
    this.resultsContent = document.getElementById('results-content');
    this.aiIntro        = document.getElementById('ai-intro');
    this.toyGrid        = document.getElementById('toy-grid');

    this.filterCategory = document.getElementById('filter-category');
    this.filterSort     = document.getElementById('filter-sort');

    this.wishlistBtn    = document.getElementById('wishlist-btn');
    this.wishlistBadge  = document.getElementById('wishlist-badge');
    this.drawerOverlay  = document.getElementById('drawer-overlay');
    this.wishlistDrawer = document.getElementById('wishlist-drawer');
    this.drawerClose    = document.getElementById('drawer-close');
    this.drawerBody     = document.getElementById('drawer-body');
    this.drawerEmpty    = document.getElementById('drawer-empty');
    this.drawerList     = document.getElementById('drawer-list');

    this.errorBanner    = document.getElementById('error-banner');
    this.errorMessage   = document.getElementById('error-message');
    this.errorClose     = document.getElementById('error-close');
  }

  _bindEvents() {
    // Age slider
    this.ageSlider.addEventListener('input', () => {
      this.age = parseInt(this.ageSlider.value, 10);
      this._updateAgeDisplay();
      this._updateSliderFill();
    });
    this._updateAgeDisplay();
    this._updateSliderFill();

    // Gender toggles
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        this.gender = btn.dataset.gender;
      });
    });

    // Interest chips
    document.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const cat = chip.dataset.category;
        if (this.interests.includes(cat)) {
          this.interests = this.interests.filter(i => i !== cat);
          chip.classList.remove('active');
          chip.setAttribute('aria-pressed', 'false');
        } else {
          this.interests.push(cat);
          chip.classList.add('active');
          chip.setAttribute('aria-pressed', 'true');
        }
      });
    });

    // Budget buttons
    document.querySelectorAll('.budget-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.budget-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        this.budget = {
          min: parseInt(btn.dataset.min, 10),
          max: parseInt(btn.dataset.max, 10),
        };
      });
    });

    // Textarea
    this.descTextarea.addEventListener('input', () => {
      const val = this.descTextarea.value.slice(0, 500);
      this.description = val;
      this.charCount.textContent = `${val.length} / 500`;
    });

    // Submit
    this.submitBtn.addEventListener('click', () => this._findToys());

    // Filters
    this.filterCategory.addEventListener('change', () => this._renderFilteredResults());
    this.filterSort.addEventListener('change', () => this._renderFilteredResults());

    // Wishlist
    this.wishlistBtn.addEventListener('click', () => this._openDrawer());
    this.drawerClose.addEventListener('click', () => this._closeDrawer());
    this.drawerOverlay.addEventListener('click', () => this._closeDrawer());

    // Error dismiss
    this.errorClose.addEventListener('click', () => this._hideError());

    // Keyboard: close drawer on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this._closeDrawer();
    });
  }

  // ── Age helpers ───────────────────────────────────────────────────────────

  _updateAgeDisplay() {
    this.ageDisplay.textContent = this.age === 0
      ? 'Newborn / Infant'
      : `${this.age} year${this.age === 1 ? '' : 's'} old`;
  }

  _updateSliderFill() {
    const pct = (this.age / 5) * 100;
    this.ageSlider.style.background =
      `linear-gradient(to right, var(--teal) 0%, var(--teal) ${pct}%, #C8E8E4 ${pct}%)`;
  }

  // ── Main recommendation call ──────────────────────────────────────────────

  async _findToys() {
    if (this._submitting) return;
    this._submitting = true;
    this.submitBtn.disabled = true;

    this._hideError();
    this._showLoading();

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: this.age,
          gender: this.gender,
          interests: this.interests,
          budget: this.budget,
          description: this.description,
        }),
      });

      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${response.status})`);
      }

      const data = await response.json();

      if (!data.recommendations || data.recommendations.length === 0) {
        throw new Error('No matching toys found. Try adjusting the filters!');
      }

      this.allResults = data.recommendations;
      this.aiIntro.textContent = data.intro || '';
      this._showResults();
      this._renderFilteredResults();

      // Scroll to results
      setTimeout(() => {
        this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (err) {
      this._hideLoading();
      this._showError(err.message || 'Something went wrong. Please try again.');
    } finally {
      this._submitting = false;
      this.submitBtn.disabled = false;
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  _showLoading() {
    this.resultsSection.hidden = false;
    this.loadingState.hidden = false;
    this.resultsContent.hidden = true;
  }

  _hideLoading() {
    this.loadingState.hidden = true;
  }

  _showResults() {
    this._hideLoading();
    this.resultsSection.hidden = false;
    this.resultsContent.hidden = false;
  }

  _renderFilteredResults() {
    const catFilter  = this.filterCategory.value;
    const sortFilter = this.filterSort.value;

    let filtered = [...this.allResults];

    if (catFilter !== 'all') {
      filtered = filtered.filter(t => t.category === catFilter);
    }

    if (sortFilter === 'price-asc') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortFilter === 'price-desc') {
      filtered.sort((a, b) => b.price - a.price);
    } else {
      filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    this._renderToyGrid(filtered);
  }

  _renderToyGrid(toys) {
    this.toyGrid.innerHTML = '';

    if (toys.length === 0) {
      this.toyGrid.innerHTML = `<p style="color:var(--ink-soft);grid-column:1/-1;text-align:center;padding:40px 0;">No toys match this filter. Try a different category!</p>`;
      return;
    }

    toys.forEach((toy, i) => {
      const card = this._buildCard(toy);
      card.style.animationDelay = `${i * 60}ms`;
      this.toyGrid.appendChild(card);
      // Trigger animation after insertion
      requestAnimationFrame(() => card.classList.add('visible'));
    });
  }

  _buildCard(toy) {
    const isWishlisted = this.wishlist.has(toy.id);
    const ageLabel = toy.ageMin === toy.ageMax
      ? `Age ${toy.ageMin}`
      : `Ages ${toy.ageMin}–${toy.ageMax}`;

    const card = document.createElement('article');
    card.className = 'toy-card';
    card.setAttribute('role', 'listitem');
    card.dataset.id = toy.id;

    const imgContent = toy.illustrationUrl
      ? `<img class="card-illustration" src="${toy.illustrationUrl}" alt="Watercolor illustration of ${toy.name}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
         <div class="card-img-placeholder" data-cat="${toy.category}" style="display:none;">${CATEGORY_EMOJI[toy.category] || '🎁'}</div>`
      : `<div class="card-img-placeholder" data-cat="${toy.category}">${CATEGORY_EMOJI[toy.category] || '🎁'}</div>`;

    card.innerHTML = `
      <div class="card-bar" data-cat="${toy.category}"></div>
      <div class="card-img-wrap">
        ${imgContent}
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span class="card-category" data-cat="${toy.category}">${toy.category}</span>
          <span class="card-age">${ageLabel}</span>
        </div>
        <h3 class="card-name">${toy.name}</h3>
        <div class="card-blurb">${toy.blurb || toy.description}</div>
        <div class="card-footer">
          <span class="card-price">$${toy.price.toFixed(2)}</span>
          <div class="card-actions">
            <button
              class="heart-btn ${isWishlisted ? 'wishlisted' : ''}"
              aria-label="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
              data-id="${toy.id}"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWishlisted ? '#EF4444' : 'none'}" stroke="${isWishlisted ? '#EF4444' : 'currentColor'}" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>
            <a class="buy-btn" href="${toy.buyUrl}" target="_blank" rel="noopener noreferrer" aria-label="Buy ${toy.name}">
              Buy Now
            </a>
          </div>
        </div>
      </div>
    `;

    card.querySelector('.heart-btn').addEventListener('click', (e) => {
      e.preventDefault();
      this._toggleWishlist(toy, card.querySelector('.heart-btn'));
    });

    return card;
  }

  // ── Wishlist ──────────────────────────────────────────────────────────────

  _toggleWishlist(toy, btn) {
    if (this.wishlist.has(toy.id)) {
      this.wishlist.delete(toy.id);
      btn.classList.remove('wishlisted');
      btn.setAttribute('aria-label', 'Add to wishlist');
      btn.querySelector('svg').setAttribute('fill', 'none');
      btn.querySelector('svg').setAttribute('stroke', 'currentColor');
    } else {
      this.wishlist.set(toy.id, toy);
      btn.classList.add('wishlisted');
      btn.setAttribute('aria-label', 'Remove from wishlist');
      btn.querySelector('svg').setAttribute('fill', '#EF4444');
      btn.querySelector('svg').setAttribute('stroke', '#EF4444');
    }

    this._saveWishlist();
    this._updateWishlistBadge();

    // Refresh drawer if open
    if (this.wishlistDrawer.classList.contains('open')) {
      this._renderDrawer();
    }
  }

  _updateWishlistBadge() {
    const count = this.wishlist.size;
    this.wishlistBadge.textContent = count;

    // Bump animation
    this.wishlistBadge.classList.remove('bump');
    void this.wishlistBadge.offsetWidth; // reflow
    this.wishlistBadge.classList.add('bump');
  }

  _openDrawer() {
    this._renderDrawer();
    this.wishlistDrawer.classList.add('open');
    this.drawerOverlay.classList.add('open');
    this.wishlistDrawer.setAttribute('aria-hidden', 'false');
    this.drawerOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  _closeDrawer() {
    this.wishlistDrawer.classList.remove('open');
    this.drawerOverlay.classList.remove('open');
    this.wishlistDrawer.setAttribute('aria-hidden', 'true');
    this.drawerOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  _renderDrawer() {
    const items = [...this.wishlist.values()];
    this.drawerList.innerHTML = '';

    if (items.length === 0) {
      this.drawerEmpty.style.display = 'block';
      return;
    }

    this.drawerEmpty.style.display = 'none';
    items.forEach(toy => {
      const item = document.createElement('div');
      item.className = 'drawer-item';
      item.innerHTML = `
        <img
          class="drawer-item-img"
          src="${toy.image}"
          alt="${toy.name}"
          onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect width=%2260%22 height=%2260%22 fill=%22%23FFF8F0%22/></svg>'"
        />
        <div class="drawer-item-info">
          <div class="drawer-item-name">${toy.name}</div>
          <div class="drawer-item-price">$${toy.price.toFixed(2)}</div>
        </div>
        <button class="drawer-remove" aria-label="Remove ${toy.name} from wishlist" data-id="${toy.id}">✕</button>
      `;

      item.querySelector('.drawer-remove').addEventListener('click', () => {
        this.wishlist.delete(toy.id);
        this._saveWishlist();
        this._updateWishlistBadge();
        this._renderDrawer();
        // Update heart on grid card if visible
        const gridCard = document.querySelector(`.toy-card[data-id="${toy.id}"]`);
        if (gridCard) {
          const heartBtn = gridCard.querySelector('.heart-btn');
          heartBtn.classList.remove('wishlisted');
          heartBtn.setAttribute('aria-label', 'Add to wishlist');
          heartBtn.querySelector('svg').setAttribute('fill', 'none');
          heartBtn.querySelector('svg').setAttribute('stroke', 'currentColor');
        }
      });

      this.drawerList.appendChild(item);
    });
  }

  // ── LocalStorage ──────────────────────────────────────────────────────────

  _loadWishlist() {
    try {
      const raw = localStorage.getItem('wunder_wishlist');
      if (!raw) return new Map();
      const arr = JSON.parse(raw);
      return new Map(arr);
    } catch {
      return new Map();
    }
  }

  _saveWishlist() {
    try {
      const arr = [...this.wishlist.entries()];
      localStorage.setItem('wunder_wishlist', JSON.stringify(arr));
    } catch {
      // localStorage unavailable — silently ignore
    }
  }

  // ── Error UI ──────────────────────────────────────────────────────────────

  _showError(msg) {
    this.errorMessage.textContent = msg;
    this.errorBanner.hidden = false;
    this.errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  _hideError() {
    this.errorBanner.hidden = true;
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  new WunderApp();
});
