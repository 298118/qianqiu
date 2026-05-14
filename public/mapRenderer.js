// public/mapRenderer.js
(function() {
  if (!window.PIXI) {
    console.warn("PixiJS not loaded. MapRenderer will not be available.");
    return;
  }

  const ROUTE_ANIMATION_LIMIT = 15;
  const EFFECT_ANIMATION_LIMIT = 25;
  const ROUTE_BASE_ALPHA = 0.4;
  const ROUTE_ALPHA_PULSE = 0.12;
  const RIPPLE_SCALE_PULSE = 0.08;
  const RIPPLE_ALPHA_PULSE = 0.24;
  const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  class MapRenderer {
    constructor(container, options = {}) {
      this.container = container;
      this.options = options;
      this.app = new PIXI.Application({
        resizeTo: container,
        backgroundAlpha: 0,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        antialias: true
      });
      container.appendChild(this.app.view);

      this.layers = {
        base: new PIXI.Container(),
        routes: new PIXI.Container(),
        places: new PIXI.Container(),
        events: new PIXI.Container(),
        selection: new PIXI.Container()
      };

      this.app.stage.addChild(this.layers.base);
      this.app.stage.addChild(this.layers.routes);
      this.app.stage.addChild(this.layers.places);
      this.app.stage.addChild(this.layers.events);
      this.app.stage.addChild(this.layers.selection);

      this.markers = new Map();
      this.animatedEffects = [];
      this.fallbackTexture = null;
      this.assets = null;
      this.assetsLoading = false;
      this.isPanelVisible = true;
      this.isDocumentVisible = document.visibilityState !== "hidden";

      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(container);
      
      this.motionMediaQuery = window.matchMedia(MOTION_QUERY);
      this.reducedMotion = this.motionMediaQuery.matches;
      this.handleMotionPreferenceChange = (e) => {
        this.reducedMotion = e.matches;
      };
      if (this.motionMediaQuery.addEventListener) {
        this.motionMediaQuery.addEventListener("change", this.handleMotionPreferenceChange);
      } else if (this.motionMediaQuery.addListener) {
        this.motionMediaQuery.addListener(this.handleMotionPreferenceChange);
      }

      this.handleVisibilityChange = () => {
        this.isDocumentVisible = document.visibilityState !== "hidden";
      };
      document.addEventListener("visibilitychange", this.handleVisibilityChange);

      this.intersectionObserver = null;
      if ("IntersectionObserver" in window) {
        this.intersectionObserver = new IntersectionObserver((entries) => {
          const entry = entries[0];
          this.isPanelVisible = !entry || entry.isIntersecting;
        });
        this.intersectionObserver.observe(container);
      }
      
      this.initFallbackTexture();
      this.app.ticker.add(this.onTick, this);
    }

    initFallbackTexture() {
      const g = new PIXI.Graphics();
      g.beginFill(0x354b63, 0.8);
      g.drawCircle(0, 0, 5);
      g.endFill();
      this.fallbackTexture = this.app.renderer.generateTexture(g);
    }

    async loadAssets() {
        if (this.assets || this.assetsLoading) return;
        this.assetsLoading = true;
        try {
            const response = await fetch('/assets/maps/ink-map-manifest.json');
            if (!response.ok) throw new Error('Manifest not found');
            const manifest = await response.json();
            
            // Build PIXI load bundle
            const loadConfig = {};
            
            if (manifest.assets) {
                manifest.assets.forEach(asset => {
                    loadConfig[asset.id] = asset.path;
                });
            }
            if (manifest.icons) {
                Object.entries(manifest.icons).forEach(([key, path]) => {
                    loadConfig[`icon_${key}`] = path;
                });
            }
            if (manifest.effects) {
                 Object.entries(manifest.effects).forEach(([key, path]) => {
                    loadConfig[`effect_${key}`] = path;
                });
            }
            
            PIXI.Assets.addBundle('ink-map-v1', loadConfig);
            this.assets = await PIXI.Assets.loadBundle('ink-map-v1');
            
            if (this.lastView) {
                if (this.options.onNeedsUpdate) {
                    this.options.onNeedsUpdate();
                } else {
                    this.update(this.lastView);
                }
            }
        } catch(e) {
            console.warn('Failed to load map assets', e);
            this.assets = 'fallback'; // mark as attempted
        } finally {
            this.assetsLoading = false;
        }
    }

    project(x, y) {
      const width = this.app.screen.width;
      const height = this.app.screen.height;
      const targetW = 2400;
      const targetH = 1600;
      
      const scaleX = width / targetW;
      const scaleY = height / targetH;
      const scale = Math.max(scaleX, scaleY);
      
      const offsetX = (width - targetW * scale) / 2;
      const offsetY = (height - targetH * scale) / 2;
      
      return {
        x: x * targetW * scale + offsetX,
        y: y * targetH * scale + offsetY
      };
    }

    update(mapRuntimeView) {
      if (!mapRuntimeView) return;
      this.lastView = mapRuntimeView;
      
      if (!this.assets) {
          this.loadAssets();
      }

      this.clear();
      
      if (this.assets && this.assets !== 'fallback') {
         if (this.assets['ink-world-base-v1']) {
            const baseSprite = new PIXI.Sprite(this.assets['ink-world-base-v1']);
            // Scale background to cover
            const scale = Math.max(this.app.screen.width / baseSprite.width, this.app.screen.height / baseSprite.height);
            baseSprite.scale.set(scale);
            baseSprite.anchor.set(0.5);
            baseSprite.x = this.app.screen.width / 2;
            baseSprite.y = this.app.screen.height / 2;
            this.layers.base.addChild(baseSprite);
         }
      }

      (mapRuntimeView.routes || []).forEach(route => {
        if (!route.layoutPath || route.layoutPath.length < 2) return;
        const path = new PIXI.Graphics();
        path.lineStyle(2, 0x685743, 1);
        path.alpha = ROUTE_BASE_ALPHA;
        const start = this.project(route.layoutPath[0][0], route.layoutPath[0][1]);
        path.moveTo(start.x, start.y);
        for (let i = 1; i < route.layoutPath.length; i++) {
          const pt = this.project(route.layoutPath[i][0], route.layoutPath[i][1]);
          path.lineTo(pt.x, pt.y);
        }

        path.eventMode = 'static';
        path.cursor = 'pointer';
        path.on('pointertap', () => {
           const midPoint = this.project(
              route.layoutPath[Math.floor(route.layoutPath.length / 2)][0],
              route.layoutPath[Math.floor(route.layoutPath.length / 2)][1]
           );
           this.selectRef(route, midPoint);
           if (this.options.onClickRef) this.options.onClickRef(route, midPoint);
        });

        this.layers.routes.addChild(path);

        // 案头舆图里的路线只做透明度轻呼吸，避免重算路径几何。
        if (!this.reducedMotion && this.countAnimatedEffects("route") < ROUTE_ANIMATION_LIMIT) {
            this.animatedEffects.push({
               type: 'route',
               sprite: path,
               baseAlpha: ROUTE_BASE_ALPHA,
               seed: Math.random() * 100
            });
        }
      });

      (mapRuntimeView.refs || []).forEach(ref => {
        if (!ref.layout) return;
        const pos = this.project(ref.layout.x, ref.layout.y);
        
        let marker;
        if (this.assets && this.assets !== 'fallback' && ref.style && ref.style.token && this.assets[`icon_${ref.style.token}`]) {
            marker = new PIXI.Sprite(this.assets[`icon_${ref.style.token}`]);
            marker.scale.set(0.5); // Adjust based on icon original size
        } else {
            marker = new PIXI.Sprite(this.fallbackTexture);
            if (ref.style && ref.style.token === "city_prefecture") {
              marker.scale.set(1.4);
            } else if (ref.style && ref.style.token === "city_county") {
              marker.scale.set(1.0);
            } else {
              marker.scale.set(0.8);
            }
        }

        marker.anchor.set(0.5);
        marker.x = pos.x;
        marker.y = pos.y;

        marker.eventMode = 'static';
        marker.cursor = 'pointer';
        marker.on('pointertap', () => {
          this.selectRef(ref, pos);
          if (this.options.onClickRef) this.options.onClickRef(ref, pos);
        });

        this.layers.places.addChild(marker);
        this.markers.set(ref.mapEntityRef, marker);
        
        if (this.options.onRenderLabel) {
           this.options.onRenderLabel(ref, pos);
        }
      });
      
      const topEffects = [...(mapRuntimeView.eventEffects || [])]
          .sort((a, b) => (b.severity || 0) - (a.severity || 0));

      topEffects.forEach(effect => {
         const targetMarker = this.markers.get(effect.targetRef);
         if (targetMarker) {
            let effectDisplay;
            if (this.assets && this.assets !== 'fallback' && effect.animationToken && this.assets[`effect_${effect.animationToken}`]) {
                effectDisplay = new PIXI.Sprite(this.assets[`effect_${effect.animationToken}`]);
                effectDisplay.anchor.set(0.5);
                effectDisplay.alpha = Math.min(1, effect.severity);
                // initial scale
                effectDisplay.scale.set(0.5 + effect.severity * 0.5);
            } else {
                effectDisplay = new PIXI.Graphics();
                effectDisplay.lineStyle(2, 0x9b2f22, Math.min(1, effect.severity * 1.5));
                effectDisplay.drawCircle(0, 0, 16 + effect.severity * 20);
            }
            effectDisplay.x = targetMarker.x;
            effectDisplay.y = targetMarker.y;
            effectDisplay.hitArea = new PIXI.Circle(0, 0, 28 + Math.min(1, effect.severity || 0) * 14);

            effectDisplay.eventMode = 'static';
            effectDisplay.cursor = 'pointer';
            effectDisplay.on('pointertap', () => {
               const targetRef = (mapRuntimeView.refs || []).find(r => r.mapEntityRef === effect.targetRef);
               const clickRef = {
                 ...(targetRef || {}),
                 mapEntityRef: targetRef?.mapEntityRef || effect.targetRef,
                 sourceRef: targetRef?.sourceRef || effect.targetRef,
                 sourceRefs: effect.sourceRefs || [],
                 label: effect.label || targetRef?.label || "地图近事",
                 summary: targetRef?.label
                   ? `${targetRef.label}附近有${effect.label || "近事"}牵动。${targetRef.summary || ""}`
                   : effect.kind || ""
               };
               this.selectRef(clickRef, targetMarker.position);
               if (this.options.onClickRef) this.options.onClickRef(clickRef, targetMarker.position);
            });

            this.layers.events.addChild(effectDisplay);
            
            // 高压力近事优先获得涟漪动效，超量时保留静态纹样。
            if (!this.reducedMotion && effect.animationToken && this.countAnimatedEffects("ripple") < EFFECT_ANIMATION_LIMIT) {
                this.animatedEffects.push({
                    type: 'ripple',
                    sprite: effectDisplay,
                    baseScale: effectDisplay.scale.x,
                    baseAlpha: effectDisplay.alpha,
                    seed: Math.random() * 100,
                    speed: 0.003 + Math.random() * 0.002
                });
            }
         }
      });
    }
    
    selectRef(ref, pos) {
       this.layers.selection.removeChildren().forEach(child => child.destroy({ children: true }));
       if (!ref || !pos) return;

       const highlight = new PIXI.Graphics();
       highlight.lineStyle(3, 0x9b2f22, 0.84);
       highlight.drawCircle(0, 0, 27);
       highlight.lineStyle(1, 0x9b2f22, 0.64);
       highlight.drawCircle(0, 0, 19);
       highlight.x = pos.x;
       highlight.y = pos.y;
       this.layers.selection.addChild(highlight);
    }

    countAnimatedEffects(type) {
      return this.animatedEffects.filter(effect => effect.type === type).length;
    }

    onTick() {
        if (this.reducedMotion || !this.isPanelVisible || !this.isDocumentVisible) return;
        const time = performance.now() * 0.005;
        for (const eff of this.animatedEffects) {
            const wave = Math.sin(time + eff.seed);
            if (eff.type === "route") {
                eff.sprite.alpha = eff.baseAlpha + wave * ROUTE_ALPHA_PULSE;
            } else if (eff.type === "ripple") {
                const spread = (wave + 1) / 2;
                eff.sprite.scale.set(eff.baseScale * (1 + spread * RIPPLE_SCALE_PULSE));
                eff.sprite.alpha = Math.max(0.08, eff.baseAlpha - spread * RIPPLE_ALPHA_PULSE);
            }
        }
    }

    clear() {
      // Clear children, but properly destroy them first to prevent leaks
      [this.layers.base, this.layers.routes, this.layers.places, this.layers.events, this.layers.selection].forEach(layer => {
          while (layer.children[0]) {
             layer.children[0].destroy({ children: true });
          }
      });
      this.markers.clear();
      this.animatedEffects = [];
    }

    onResize() {
      if (this._resizeDebounce) clearTimeout(this._resizeDebounce);
      this._resizeDebounce = setTimeout(() => {
        this.app.resize();
        if (this.options.onNeedsUpdate) {
          this.options.onNeedsUpdate();
        }
      }, 100);
    }

    destroy() {
      this.resizeObserver.disconnect();
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      if (this.motionMediaQuery.removeEventListener) {
        this.motionMediaQuery.removeEventListener("change", this.handleMotionPreferenceChange);
      } else if (this.motionMediaQuery.removeListener) {
        this.motionMediaQuery.removeListener(this.handleMotionPreferenceChange);
      }
      this.app.ticker.remove(this.onTick, this);
      this.app.destroy(true, { children: true });
    }
  }

  window.MapRenderer = MapRenderer;
})();
