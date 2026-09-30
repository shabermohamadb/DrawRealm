/**
 * DrawRealm Client-side Accessory Catalog & Selector Controller
 */
(function(window, document) {
  "use strict";

  const ACCESSORIES = [
    // --- HEAD ACCESSORIES (14) ---
    {
      id: "headphones_gaming",
      name: "Gaming Headset",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "headphones_gaming.svg",
      description: "High-end gaming headset with cyan LED glow and mic boom"
    },
    {
      id: "headphones_wireless",
      name: "Wireless Headphones",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "headphones_wireless.svg",
      description: "Sleek minimalist wireless over-ear headphones"
    },
    {
      id: "headphones_studio",
      name: "Studio Headphones",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "headphones_studio.svg",
      description: "Chunky professional studio monitor headphones"
    },
    {
      id: "headphones_simple",
      name: "Simple Headphones",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "headphones_simple.svg",
      description: "Retro thin-wire on-ear headphones with orange foam pads"
    },
    {
      id: "cap",
      name: "Snapback Cap",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "cap.svg",
      description: "Urban streetwear snapback baseball cap"
    },
    {
      id: "beanie",
      name: "Ribbed Beanie",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "beanie.svg",
      description: "Cozy folded knit beanie hugging the crown"
    },
    {
      id: "crown",
      name: "Royal Crown",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "crown.svg",
      description: "Gleaming golden royal circlet with a crimson jewel"
    },
    {
      id: "headband",
      name: "Ninja Headband",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "headband.svg",
      description: "Martial arts headband with metal plate and trailing ties"
    },
    {
      id: "hair_clip",
      name: "Star Hair Clips",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "hair_clip.svg",
      description: "Glittering golden star and cross bobby clips"
    },
    {
      id: "hair_band",
      name: "Bow Headband",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "hair_band.svg",
      description: "Velvet alice hairband topped with a side ribbon bow"
    },
    {
      id: "hat",
      name: "Classic Fedora",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "hat.svg",
      description: "Crisp stylish fedora with dark silk ribbon"
    },
    {
      id: "cowboy_hat",
      name: "Cowboy Hat",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "cowboy_hat.svg",
      description: "Rugged western leather cowboy hat with curved brim"
    },
    {
      id: "wizard_hat",
      name: "Wizard Hat",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "wizard_hat.svg",
      description: "Mystic pointed arcane wizard hat with golden star buckle"
    },
    {
      id: "helmet",
      name: "Cyber Helmet",
      category: "head",
      categoryLabel: "Headwear",
      layer: "front",
      file: "helmet.svg",
      description: "Futuristic tactical helmet with cybernetic visor plate"
    },

    // --- FACE ACCESSORIES (8) ---
    {
      id: "glasses",
      name: "Classic Glasses",
      category: "face",
      categoryLabel: "Eyewear",
      layer: "front",
      file: "glasses.svg",
      description: "Modern black acetate rectangular frame glasses"
    },
    {
      id: "sunglasses",
      name: "Sunglasses",
      category: "face",
      categoryLabel: "Eyewear",
      layer: "front",
      file: "sunglasses.svg",
      description: "Cool dark tinted aviator shades with specular sheen"
    },
    {
      id: "round_glasses",
      name: "Round Glasses",
      category: "face",
      categoryLabel: "Eyewear",
      layer: "front",
      file: "round_glasses.svg",
      description: "Vintage gold-wire circular spectacles"
    },
    {
      id: "cyber_glasses",
      name: "Cyber Glasses",
      category: "face",
      categoryLabel: "Eyewear",
      layer: "front",
      file: "cyber_glasses.svg",
      description: "Glowing neon cyan cyberpunk HUD visor glasses"
    },
    {
      id: "visor",
      name: "Sports Visor",
      category: "face",
      categoryLabel: "Eyewear",
      layer: "front",
      file: "visor.svg",
      description: "Translucent tinted sports visor angled over forehead"
    },
    {
      id: "mask",
      name: "Tech Mask",
      category: "face",
      categoryLabel: "Facewear",
      layer: "front",
      file: "mask.svg",
      description: "Streetwear black tech mask covering nose and mouth"
    },
    {
      id: "half_mask",
      name: "Half Mask",
      category: "face",
      categoryLabel: "Facewear",
      layer: "front",
      file: "half_mask.svg",
      description: "Handcrafted kitsune porcelain half-mask on cheek"
    },
    {
      id: "face_bandage",
      name: "Face Bandage",
      category: "face",
      categoryLabel: "Facewear",
      layer: "front",
      file: "face_bandage.svg",
      description: "Anime crossed adhesive medical bandage over nose bridge"
    },

    // --- SPECIAL ACCESSORIES (9) ---
    {
      id: "cat_ears",
      name: "Cat Ears",
      category: "special",
      categoryLabel: "Special",
      layer: "front",
      file: "cat_ears.svg",
      description: "Fluffy anime nekomimi cat ears with soft pink interior"
    },
    {
      id: "wolf_ears",
      name: "Wolf Ears",
      category: "special",
      categoryLabel: "Special",
      layer: "front",
      file: "wolf_ears.svg",
      description: "Sharp wild grey wolf ears with dark tips"
    },
    {
      id: "demon_horns",
      name: "Demon Horns",
      category: "special",
      categoryLabel: "Special",
      layer: "front",
      file: "demon_horns.svg",
      description: "Symmetrical curving crimson demon horns"
    },
    {
      id: "angel_halo",
      name: "Angel Halo",
      category: "special",
      categoryLabel: "Special",
      layer: "front",
      file: "angel_halo.svg",
      description: "Luminous gold ring hovering peacefully above head"
    },
    {
      id: "small_wings",
      name: "Small Wings",
      category: "special",
      categoryLabel: "Back Item",
      layer: "back",
      file: "small_wings.svg",
      description: "Graceful feathered angelic wings spreading behind shoulders"
    },
    {
      id: "shoulder_pet",
      name: "Shoulder Pet",
      category: "special",
      categoryLabel: "Companion",
      layer: "front",
      file: "shoulder_pet.svg",
      description: "Adorable cheerful cyan slime sitting on the shoulder"
    },
    {
      id: "floating_orb",
      name: "Floating Orb",
      category: "special",
      categoryLabel: "Special",
      layer: "front",
      file: "floating_orb.svg",
      description: "Swirling violet arcane energy orb orbiting beside player"
    },
    {
      id: "small_backpack",
      name: "Small Backpack",
      category: "special",
      categoryLabel: "Back Item",
      layer: "back",
      file: "small_backpack.svg",
      description: "Compact canvas adventurer backpack strapped behind torso"
    },
    {
      id: "scarf",
      name: "Scarf",
      category: "special",
      categoryLabel: "Special",
      layer: "front",
      file: "scarf.svg",
      description: "Wind-swept ruby red winter scarf wrapped around neck"
    }
  ];

  const ACCESSORIES_BY_ID = new Map(ACCESSORIES.map(acc => [acc.id, acc]));

  function getAccessory(id) {
    if (!id || typeof id !== "string") return null;
    return ACCESSORIES_BY_ID.get(id) || null;
  }

  function isValidAccessoryId(id) {
    return ACCESSORIES_BY_ID.has(id);
  }

  function getAccessoriesByCategory(category) {
    if (!category || category === "all") return ACCESSORIES;
    return ACCESSORIES.filter(acc => acc.category === category);
  }

  // Global exposure
  window.DRAWREALM_ACCESSORIES = ACCESSORIES;
  window.DRAWREALM_ACCESSORIES_MAP = ACCESSORIES_BY_ID;
  window.getDrawrealmAccessory = getAccessory;
  window.isValidAccessoryId = isValidAccessoryId;
  window.getDrawrealmAccessoriesByCategory = getAccessoriesByCategory;

  // Interactive Accessory Selector Controller
  const DrawRealmAccessories = {
    accessories: ACCESSORIES,
    getAccessory: getAccessory,
    isValidAccessoryId: isValidAccessoryId,
    getAccessoriesByCategory: getAccessoriesByCategory,

    currentCategory: "head",
    currentAccessoryId: "",
    onSelectCallback: null,

    initSelector: function(opts) {
      opts = opts || {};
      const container = opts.container || (document ? document.querySelector(".accessory-selector-container") : null);
      if (!container) return;

      this.container = container;
      this.currentAccessoryId = opts.initialId || "";
      this.onSelectCallback = opts.onSelect || function() {};

      this.tabs = container.querySelectorAll(".acc-tab");
      this.prevBtn = container.querySelector(".acc-prev");
      this.nextBtn = container.querySelector(".acc-next");
      this.randomBtn = container.querySelector(".acc-random-btn");
      this.titleEl = container.querySelector(".acc-title");
      this.badgeEl = container.querySelector(".acc-category-badge");

      if (this.currentAccessoryId) {
        const item = getAccessory(this.currentAccessoryId);
        if (item) {
          this.currentCategory = item.category;
        } else {
          this.currentAccessoryId = "";
          this.currentCategory = "head";
        }
      } else {
        this.currentCategory = "head";
      }

      this._bindEvents();
      this.updateUI(this.currentAccessoryId);
    },

    _bindEvents: function() {
      const self = this;

      if (this.tabs) {
        this.tabs.forEach(tab => {
          tab.addEventListener("click", function() {
            const cat = this.dataset.category;
            self.setCategory(cat);
          });
        });
      }

      if (this.prevBtn) {
        this.prevBtn.addEventListener("click", function() {
          self.navigateCategory(-1);
        });
      }

      if (this.nextBtn) {
        this.nextBtn.addEventListener("click", function() {
          self.navigateCategory(1);
        });
      }

      if (this.randomBtn) {
        this.randomBtn.addEventListener("click", function() {
          self.randomizeAccessory();
        });
      }
    },

    setCategory: function(cat) {
      this.currentCategory = cat;
      if (cat === "none") {
        this.selectAccessory("");
        return;
      }

      const current = getAccessory(this.currentAccessoryId);
      if (!current || current.category !== cat) {
        const items = getAccessoriesByCategory(cat);
        if (items.length > 0) {
          this.selectAccessory(items[0].id);
        } else {
          this.selectAccessory("");
        }
      } else {
        this.updateUI(this.currentAccessoryId);
      }
    },

    navigateCategory: function(dir) {
      if (this.currentCategory === "none") {
        this.currentCategory = "head";
      }

      const items = getAccessoriesByCategory(this.currentCategory);
      if (items.length === 0) {
        this.selectAccessory("");
        return;
      }

      const fullList = [null, ...items];
      let currentIdx = 0;
      if (this.currentAccessoryId) {
        const found = items.findIndex(it => it.id === this.currentAccessoryId);
        if (found !== -1) {
          currentIdx = found + 1;
        }
      }

      let nextIdx = (currentIdx + dir) % fullList.length;
      if (nextIdx < 0) nextIdx += fullList.length;

      const chosen = fullList[nextIdx];
      this.selectAccessory(chosen ? chosen.id : "");
    },

    selectAccessory: function(accId) {
      this.currentAccessoryId = accId || "";
      if (this.currentAccessoryId) {
        const item = getAccessory(this.currentAccessoryId);
        if (item) {
          this.currentCategory = item.category;
        } else {
          this.currentAccessoryId = "";
        }
      }
      this.updateUI(this.currentAccessoryId);
      if (typeof this.onSelectCallback === "function") {
        this.onSelectCallback(this.currentAccessoryId);
      }
    },

    randomizeAccessory: function() {
      if (ACCESSORIES.length === 0) return;
      const randIdx = Math.floor(Math.random() * ACCESSORIES.length);
      const chosen = ACCESSORIES[randIdx];
      this.selectAccessory(chosen.id);
    },

    updateUI: function(accId) {
      this.currentAccessoryId = accId || "";

      if (this.tabs) {
        const activeCat = this.currentAccessoryId
          ? (getAccessory(this.currentAccessoryId)?.category || "none")
          : (this.currentCategory === "none" ? "none" : this.currentCategory);

        this.tabs.forEach(tab => {
          if (this.currentAccessoryId === "" && this.currentCategory === "none") {
            tab.classList.toggle("active", tab.dataset.category === "none");
          } else {
            tab.classList.toggle("active", tab.dataset.category === activeCat);
          }
        });
      }

      if (this.titleEl && this.badgeEl) {
        if (!this.currentAccessoryId) {
          this.titleEl.textContent = "None";
          this.badgeEl.textContent = this.currentCategory === "none"
            ? "No Accessory"
            : (this.currentCategory.toUpperCase() + " (EMPTY)");
        } else {
          const item = getAccessory(this.currentAccessoryId);
          if (item) {
            this.titleEl.textContent = item.name;
            this.badgeEl.textContent = item.categoryLabel || item.category.toUpperCase();
          } else {
            this.titleEl.textContent = "None";
            this.badgeEl.textContent = "No Accessory";
          }
        }
      }
    }
  };

  window.DrawRealmAccessories = DrawRealmAccessories;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      ACCESSORIES,
      getAccessory,
      isValidAccessoryId,
      getAccessoriesByCategory,
      DrawRealmAccessories
    };
  }

})(typeof window !== "undefined" ? window : globalThis, typeof document !== "undefined" ? document : null);
