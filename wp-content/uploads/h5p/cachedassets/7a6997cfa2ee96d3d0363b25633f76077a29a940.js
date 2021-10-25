var H5P = H5P || {};

/**
 * Constructor.
 *
 * @param {Object} params Options for this library.
 * @param {Number} id Content identifier
 * @returns {undefined}
 */
(function ($) {
  H5P.Image = function (params, id) {
    H5P.EventDispatcher.call(this);

    if (params.file === undefined || !(params.file instanceof Object)) {
      this.placeholder = true;
    }
    else {
      this.source = H5P.getPath(params.file.path, id);
      this.width = params.file.width;
      this.height = params.file.height;

      // Use new copyright information if available. Fallback to old.
      if (params.file.copyright !== undefined) {
        this.copyright = params.file.copyright;
      }
      else if (params.copyright !== undefined) {
        this.copyright = params.copyright;
      }
    }

    this.alt = params.alt !== undefined ? params.alt : 'New image';

    if (params.title !== undefined) {
      this.title = params.title;
    }
  };

  H5P.Image.prototype = Object.create(H5P.EventDispatcher.prototype);
  H5P.Image.prototype.constructor = H5P.Image;

  /**
   * Wipe out the content of the wrapper and put our HTML in it.
   *
   * @param {jQuery} $wrapper
   * @returns {undefined}
   */
  H5P.Image.prototype.attach = function ($wrapper) {
    var self = this;
    var source = this.source;

    if (self.$img === undefined) {
      if(self.placeholder) {
        self.$img = $('<div>', {
          width: '100%',
          height: '100%',
          class: 'h5p-placeholder',
          title: this.title === undefined ? '' : this.title,
          load: function () {
            self.trigger('loaded');
          }
        });
      } else {
        self.$img = $('<img>', {
          width: '100%',
          height: '100%',
          src: source,
          alt: this.alt,
          title: this.title === undefined ? '' : this.title,
          load: function () {
            self.trigger('loaded');
          }
        });
      }
    }

    $wrapper.addClass('h5p-image').html(self.$img);
  };

  /**
   * Gather copyright information for the current content.
   *
   * @returns {H5P.ContentCopyright}
   */
  H5P.Image.prototype.getCopyrights = function () {
    if (this.copyright === undefined) {
      return;
    }

    var info = new H5P.ContentCopyrights();

    var image = new H5P.MediaCopyright(this.copyright);
    image.setThumbnail(new H5P.Thumbnail(this.source, this.width, this.height));
    info.addMedia(image);

    return info;
  };

  return H5P.Image;
}(H5P.jQuery));
;
var H5P = H5P || {};

H5P.Agamotto = function () {
  'use strict';
  /**
   * Constructor function.
   *
   * @param {object} options - Options from semantics.json.
   * @param {boolean} options.snap - If true, slider will snap to fixed positions.
   * @param {boolean} options.ticks - If true, slider container will display ticks.
   * @param {number} content - Id.
   */
  function Agamotto(options, id, extras) {
    if (!options.items) {
      return;
    }

    this.options = options;
    this.options.items = sanitizeItems(this.options.items);
    this.extras = extras;

    this.maxItem = this.options.items.length - 1;
    this.selector = '.h5p-agamotto-wrapper';

    // Set hasDescription = true if at least one item has a description
    this.hasDescription = this.options.items.some(function (item) {
      return item.description !== '';
    });

    this.id = id;

    // Container for KeyListeners
    this.imageContainer = undefined;

    // Currently visible image (index)
    this.position = 0;

    // Store the images that have been viewed
    this.imagesViewed = [];

    // Store the completed state for xAPI triggering
    this.completed = false;

    // Store the currently pressed key if any - false otherwise
    this.keyPressed = false;

    /**
     * Update images and descriptions.
     *
     * @param {Number} index - Index of top image.
     * @param {Number} opacity - Opacity of top image.
     */
    this.updateContent = function (index, opacity) {
      // Update images
      this.images.setImage(index, opacity);

      // Update descriptions
      if (this.hasDescription) {
        this.descriptions.setText(index, opacity);
      }

      // Remember current position (index)
      this.position = Math.round(index + (1 - opacity));

      // Remember images that have been viewed
      if (this.completed === false) {
        // Images count as viewed as of 50 % visibility
        if (this.imagesViewed.indexOf(this.position) === -1) {
          this.imagesViewed.push(this.position);
        }
      }
    };

    // Initialize event inheritance
    H5P.EventDispatcher.call(this);
  }

  // Extends the event dispatcher
  Agamotto.prototype = Object.create(H5P.EventDispatcher.prototype);
  Agamotto.prototype.constructor = Agamotto;

  // Cmp. vocabulary of xAPI statements: http://xapi.vocab.pub/datasets/adl/

  /**
   * Trigger xAPI statement 'experienced' (when interaction encountered).
   */
  Agamotto.prototype.xAPIExperienced = function () {
    this.triggerXAPI('experienced');
  };

  /**
   * Trigger xAPI statement 'interacted' (when slider moved, keys released, or link clicked).
   */
  Agamotto.prototype.xAPIInteracted = function () {
    this.triggerXAPI('interacted');
  };

  /**
   * Trigger xAPI statement 'completed' (when all images have been viewed).
   */
  Agamotto.prototype.xAPICompleted = function () {
    if ((this.imagesViewed.length === this.options.items.length) && !this.completed) {
      this.triggerXAPI('completed');
      // Only trigger this once
      this.completed = true;
    }
  };

  /**
   * Attach function called by H5P framework to insert H5P content into page.
   * TODO: Remove this jQuery dependency as soon as the H5P framework is ready
   *
   * @param {jQuery} $container - Container to attach to.
   */
  Agamotto.prototype.attach = function ($container) {
    var that = this;

    // Setup HTML DOM
    $container.addClass('h5p-agamotto');
    if (!this.options.items || this.maxItem < 1) {
      $container.append('<div class="h5p-agamotto-warning">I really need at least two images :-)</div>');
      this.trigger('resize');
      return;
    }

    /**
     * Load an Image.
     * TODO: Wouldn't this be better in images.js? Requires a promise here as well
     *
     * @param {string} imageObject - Image object.
     * @param {number} id - H5P ID.
     * @return {Promise} Promise for image being loaded.
     */
    function loadImage (imageObject, id) {
      return new Promise(function (resolve, reject) {
        var image = new Image();
        image.crossOrigin = (H5P.getCrossOrigin !== undefined ? H5P.getCrossOrigin() : 'Anonymous');
        image.onload = function() {
          resolve(this);
        };
        image.onerror = function(error) {
          reject(error);
        };
        image.src = H5P.getPath(imageObject.params.file.path, id);
      });
    }

    /*
     * Load images first before DOM is created; will help to prevent layout
     * problems in some cases.
     */
    var promises = [];
    that.options.items.forEach(function (item) {
      promises.push(loadImage(item.image, that.id));
    });
    Promise.all(promises).then(function(results) {
      that.images = results.map(function (item, index) {
        return {
          img: item,
          alt: that.options.items[index].image.params.alt,
          title: that.options.items[index].image.params.title
        };
      });

      that.wrapper = document.createElement('div');
      that.wrapper.classList.add('h5p-agamotto-wrapper');
      that.wrapper.classList.add('h5p-agamotto-passepartout-horizontal');
      that.wrapper.classList.add('h5p-agamotto-passepartout-top');
      that.wrapper.classList.add('h5p-agamotto-passepartout-bottom');
      $container.append(that.wrapper);

      // Title
      if (that.options.title) {
        var title = document.createElement('div');
        title.classList.add('h5p-agamotto-title');
        title.innerHTML = '<h2>' + that.options.title + '</h2>';
        title.setAttribute('tabindex', 0);
        that.wrapper.appendChild(title);
      }

      // Images
      that.images = new H5P.Agamotto.Images(that.images);
      that.wrapper.appendChild(that.images.getDOM());
      that.images.resize();

      // Slider
      var labelTexts = [];
      for (var i = 0; i <= that.maxItem; i++) {
        labelTexts[i] = that.options.items[i].labelText || '';
      }
      that.slider = new H5P.Agamotto.Slider({
        snap: that.options.snap,
        ticks: that.options.ticks,
        labels: that.options.labels,
        labelTexts: labelTexts,
        size: that.maxItem
      }, that.selector, that);
      that.wrapper.appendChild(that.slider.getDOM());
      that.slider.resize();

      // Descriptions
      if (that.hasDescription) {
        var descriptionTexts = [];
        for (i = 0; i <= that.maxItem; i++) {
          descriptionTexts[i] = that.options.items[i].description;
        }
        that.descriptions = new H5P.Agamotto.Descriptions(descriptionTexts, that.selector, that);
        that.wrapper.appendChild(that.descriptions.getDOM());
        that.descriptions.adjustHeight();
        // Passepartout at the bottom is not needed, because we have a description
        that.wrapper.classList.remove('h5p-agamotto-passepartout-bottom');
        that.heightDescriptions = that.descriptions.offsetHeight;
      }
      else {
        that.heightDescriptions = 0;
      }

      // Add passepartout depending on the combination of elements
      if (that.options.title) {
        // Passepartout at the top is not needed, because we have a title
        that.wrapper.classList.remove('h5p-agamotto-passepartout-top');
      }
      else if (!that.hasDescription) {
        // No passepartout is needed at all, because we just have an image
        that.wrapper.classList.remove('h5p-agamotto-passepartout-horizontal');
        that.wrapper.classList.remove('h5p-agamotto-passepartout-top');
        that.wrapper.classList.remove('h5p-agamotto-passepartout-bottom');
      }

      // KeyListeners for Images that will allow to jump from one image to another
      that.imageContainer = that.images.getDOM ();
      // TODO: Move this to Images class or remove alltogether
      that.imageContainer.addEventListener('keydown', function(e) {
        // Prevent repeated pressing of a key
        if (that.keyPressed !== false) {
          return;
        }
        that.imageContainer.classList.add('h5p-agamotto-images-keydown');
        e = e || window.event;
        var key = e.which || e.keyCode;
        if (key === 37 || key === 33) {
          e.preventDefault();
          that.keyPressed = key;
          that.slider.setPosition(Agamotto.map(Math.max(0, that.position - 1), 0, that.maxItem, 0, that.slider.getWidth()), true);
        }
        if (key === 39 || key === 34) {
          e.preventDefault();
          that.keyPressed = key;
          that.slider.setPosition(Agamotto.map(Math.min(that.position + 1, that.maxItem), 0, that.maxItem, 0, that.slider.getWidth()), true);
        }
      });
      that.imageContainer.addEventListener('keyup', function(e) {
        // Only trigger xAPI if the interaction started by a particular key has ended
        e = e || window.event;
        var key = e.which || e.keyCode;
        if (key === that.keyPressed) {
          that.keyPressed = false;
          that.xAPIInteracted();
          that.xAPICompleted();
        }
      });

      // Trigger xAPI when starting to view content
      that.xAPIExperienced();

      that.slider.on('update', function(e) {
        /*
         * Map the slider value to the image indexes. Since we might not
         * want to initiate opacity shifts right away, we can add a margin to
         * the left and right of the slider where nothing happens
         */
        var margin = 5;
        var mappedValue = Agamotto.map(
          e.data.position,
          0 + margin,
          that.slider.getWidth() - margin,
          0,
          that.maxItem
        );
        // Account for margin change and mapping outside the image indexes
        var topIndex = Agamotto.constrain(Math.floor(mappedValue), 0, that.maxItem);

        /*
         * Using the cosine will allow an image to be displayed a little longer
         * before blending than a linear function
         */
        var linearOpacity = (1 - Agamotto.constrain(mappedValue - topIndex, 0, 1));
        var topOpacity = 0.5 * (1 - Math.cos(Math.PI * linearOpacity));

        that.updateContent(topIndex, topOpacity);
      });

      // Add Resize Handler
      window.addEventListener('resize', function () {
        // Prevent infinite resize loops
        if (!that.resizeCooling) {
          /*
           * Decrease the size of the content if on a mobile device in landscape
           * orientation, because it might be hard to use it otherwise.
           * iOS devices don't switch screen.height and screen.width on rotation
           */
          if (isMobileDevice() && Math.abs(window.orientation) === 90) {
            if (/iPhone/.test(navigator.userAgent)) {
              that.wrapper.style.width = Math.round((screen.width / 2) * that.images.getRatio()) + 'px';
            }
            else {
              that.wrapper.style.width = Math.round((screen.height / 2) * that.images.getRatio()) + 'px';
            }
          }
          else {
            // Portrait orientation
            that.wrapper.style.width = 'auto';
          }

          // Resize DOM elements
          that.images.resize();
          that.slider.resize();
          // The descriptions will get a scroll bar via CSS if necessary, no resize needed
          that.trigger('resize');

          that.resizeCooling = setTimeout(function () {
            that.resizeCooling = null;
          }, RESIZE_COOLING_PERIOD);

        }

      });

      // DOM completed.
      that.trigger('resize');
    });
  };

  /**
   * Remove missing items and limit amount.
   *
   * @param {Object} items - Items defined in semantics.org.
   * @return {Object} Sanitized items.
   */
  var sanitizeItems = function (items) {
    /*
     * Remove items with missing image an restrict to 50 images, because it
     * might become hard to differentiate more positions on the slider - and
     * a video to slide over might be more sensible anyway if you need more
     * frames.
     */
     items = items
      .filter(function (item) {
        if (!item.image || !item.image.params || !item.image.params.file) {
          console.log('An image is missing. I will continue without it, but please check your settings.');
          return false;
        }
        return true;
      })
      .splice(0, 50)
      .map(function (item) {
        item.image.params.alt = item.image.params.alt || '';
        item.image.params.title = item.image.params.title || '';
        return item;
      });

    return items;
  };

  /**
   * Detect mobile devices (http://detectmobilebrowsers.com/)
   *
   * @returns {boolean} True if running on a mobile device.
   */
  var isMobileDevice = function() {
    var check = false;
    (function(a){
      if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;}) (navigator.userAgent||navigator.vendor||window.opera);
    return check;
  };

  /**
   * Map a value from one range to another.
   *
   * @param {number} value - Value to me remapped.
   * @param {number} lo1 - Lower boundary of first range.
   * @param {number} hi1 - Upper boundary of first range.
   * @param {number} lo2 - Lower boundary of second range.
   * @param {number} hi2 - Upper boundary of second range.
   * @return {number} - Remapped value.
   */
  Agamotto.map = function (value, lo1, hi1, lo2, hi2) {
    return lo2 + (hi2 - lo2) * (value - lo1) / (hi1 - lo1);
  };

  /**
   * Constrain a number value within a range.
   *
   * @param {number} value - Value to be constrained.
   * @param {number} lo - Lower boundary of the range.
   * @param {number} hi - Upper boundary of the range.
   * @returns {number} - Constrained value.
   */
  Agamotto.constrain = function (value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
  };

  // Cooldown period in ms to prevent infinite resizing
  const RESIZE_COOLING_PERIOD = 50;

  return Agamotto;
}();
;
var H5P = H5P || {};

(function (Agamotto) {
  'use strict';

  /**
   * Images object
   *
   * @class H5P.Agamotto.Images
   * @param {Object} images - Array containing the images.
   */
   Agamotto.Images = function (images) {
     this.images = images;

     this.ratio = this.images[0].img.naturalWidth / this.images[0].img.naturalHeight;

     /*
      * Users might use images with different aspect ratios -- I learned that the hard way ;-)
      * Use the dimensions of the first image, resize the others and add a black border if necessary.
      * We need the black border in the image because of the blending transition. We also need
      * it for images with transparency.
      */
     var firstMaxX = this.images[0].img.naturalWidth;
     var firstMaxY = this.images[0].img.naturalHeight;
     for (var i = 0; i < this.images.length; i++) {
       var maxX = firstMaxX;
       var maxY = firstMaxY;
       var imgX = images[i].img.naturalWidth;
       var imgY = images[i].img.naturalHeight;

       // Scale image.
       if ((imgX / imgY < this.ratio) && (imgY > maxY)) {
         imgY = maxY;
         imgX *= maxY / this.images[i].img.naturalHeight;
       }
       if ((imgX / imgY > this.ratio) && (imgX > maxX)) {
         imgX = maxX;
         imgY *= maxX / this.images[i].img.naturalWidth;
       }
       if ((imgX / imgY === this.ratio)) {
         maxX = Math.max(maxX, imgX);
         maxY = Math.max(maxY, imgY);
       }

       // Compute offset for centering.
       var offsetX = Agamotto.constrain((maxX - imgX) / 2, 0, maxX);
       var offsetY = Agamotto.constrain((maxY - imgY) / 2, 0, maxY);

       // Create scaled image with black border.
       var imageCanvas = document.createElement('canvas');
       imageCanvas.setAttribute('width', maxX);
       imageCanvas.setAttribute('height', maxY);
       var imageCtx = imageCanvas.getContext('2d');
       imageCtx.beginPath();
       imageCtx.rect(0, 0, maxX, maxY);
       imageCtx.fillStyle = 'black';
       imageCtx.fill();
       imageCtx.drawImage(this.images[i].img, offsetX, offsetY, imgX, imgY);

       // Replace the old image.
       var image = new Image();

       // This is necessary to prevent security errors in some cases.
       image.crossOrigin = (H5P.getCrossOrigin !== undefined ? H5P.getCrossOrigin() : 'Anonymous');
       image.src = imageCanvas.toDataURL('image/jpeg');
       this.images[i].img = image;
     }

     // Create DOM
     this.imageTop = document.createElement('img');
     this.imageTop.classList.add('h5p-agamotto-image-top');
     this.imageTop.src = images[0].img.src;
     this.imageTop.setAttribute('draggable', 'false');
     this.imageTop.setAttribute('alt', images[0].alt);
     this.imageTop.setAttribute('title', images[0].title);
     this.imageTop.setAttribute('aria-live', 'polite');
     this.imageTop.setAttribute('tabindex', 0);

     this.imageBottom = document.createElement('img');
     this.imageBottom.classList.add('h5p-agamotto-image-bottom');
     this.imageBottom.src = images[1].img.src;
     this.imageBottom.setAttribute('draggable', 'false');

     this.container = document.createElement('div');

     this.container.classList.add('h5p-agamotto-images-container');
     this.container.appendChild(this.imageTop);
     this.container.appendChild(this.imageBottom);
   };

   Agamotto.Images.prototype = {
     /**
      * Get the DOM elements.
      * @return {object} The DOM elements.
      */
     getDOM: function getDOM () {
       return this.container;
     },
     /**
      * Set the visible image combination.
      * @param {number} index - Image index.
      * @param {number} opacity - Image opacity, [0..1].
      */
     setImage: function setImage (index, opacity) {
       var visibleImageIndex = Math.min(this.images.length - 1, index + Math.round((1 - opacity)));
       this.imageTop.src = this.images[index].img.src;
       this.imageTop.setAttribute('alt', this.images[visibleImageIndex].alt);
       this.imageTop.setAttribute('title', this.images[visibleImageIndex].title);
       this.imageTop.style.opacity = opacity;
       this.imageBottom.src = this.images[Agamotto.constrain(index + 1, 0, this.images.length - 1)].img.src;
       this.imageTop.setAttribute('aria-label', this.images[visibleImageIndex].alt);
     },
     /**
      * Resize the images.
      * @return {boolean} True if the height of the container changed.
      */
     resize: function resize () {
       var oldHeight = this.container.style.height;
       this.container.style.height = this.container.offsetWidth / this.ratio + 'px';
       return this.container.style.height !== oldHeight;
     },
     /**
      * Get the image ratio.
      * @return {number} Image ratio.
      */
     getRatio: function getRatio() {
       return this.ratio;
     }
   };

})(H5P.Agamotto);
;
var H5P = H5P || {};

(function (Agamotto) {
  'use strict';

  /**
   * Slider object.
   *
   * @param {Object} options - Options for the slider.
   * @param {boolean} options.snap - If true, slider will snap to fixed positions.
   * @param {boolean} options.ticks - If true, slider container will display ticks.
   * @param {boolean} options.labels - If true, slider container will display tick labels.
   * @param {Object} options.labelTexts - Tick labels.
   * @param {string} options.labelTexts.text - Tick label.
   * @param {number} options.size - Number of positions/ticks.
   * @param {string} selector - CSS class name of parent node.
   * @param {string} parent - Parent class Agamotto.
   */
  Agamotto.Slider = function (options, selector, parent) {
    var that = this;

    // Slider Layout
    /** @constant {number} */
    Agamotto.Slider.CONTAINER_DEFAULT_HEIGHT = 36;
    /** @constant {number} */
    Agamotto.Slider.TRACK_OFFSET = 16;
    /** @constant {number} */
    Agamotto.Slider.THUMB_OFFSET = 8;

    options.snap = options.snap || true;
    options.ticks = options.ticks || false;
    options.labels = options.labels || false;

    this.options = options;
    this.selector = selector;
    this.parent = parent;

    this.trackWidth = 0;
    this.thumbPosition = 0;
    this.ratio = 0;

    this.ticks = [];
    this.labels = [];

    this.mousedown = false;
    this.keydown = false;
    this.interactionstarted = false;

    this.track = document.createElement('div');
    this.track.classList.add('h5p-agamotto-slider-track');

    this.thumb = document.createElement('div');
    this.thumb.classList.add('h5p-agamotto-slider-thumb');
    this.thumb.setAttribute('tabindex', 0);

    this.container = document.createElement('div');
    this.container.classList.add('h5p-agamotto-slider-container');
    this.container.setAttribute('role', 'slider');
    this.container.setAttribute('aria-valuenow', 0);
    this.container.setAttribute('aria-valuemin', 0);
    this.container.setAttribute('aria-valuemax', 100);
    this.container.appendChild(this.track);
    this.container.appendChild(this.thumb);

    /*
     * We could put the next two blocks in one loop and check for ticks/labels
     * within the loop, but then we would always loop all images even without
     * ticks and labels. Would be slower (with many images).
     */
    var i = 0;
    // Place ticks
    if (this.options.ticks === true) {
      // Function used here to avoid creating it in the upcoming loop
      var placeTicks = function() {
        that.setPosition(parseInt(this.style.left) - Agamotto.Slider.TRACK_OFFSET, true);
      };
      for (i = 0; i <= this.options.size; i++) {
        this.ticks[i] = document.createElement('div');
        this.ticks[i].classList.add('h5p-agamotto-tick');
        this.ticks[i].addEventListener('click', placeTicks);
        this.container.appendChild(this.ticks[i]);
      }
    }

    // Place labels
    if (this.options.labels === true) {
      for (i = 0; i <= this.options.size; i++) {
        this.labels[i] = document.createElement('div');
        this.labels[i].classList.add('h5p-agamotto-tick-label');
        this.labels[i].innerHTML = this.options.labelTexts[i];
        this.container.appendChild(this.labels[i]);
      }
    }

    // Event Listeners for Mouse Interface
    document.addEventListener('mousemove', function(e) {
      that.setPosition(e, false);
    });
    document.addEventListener('mouseup', function() {
      that.mousedown = false;
      that.snap();
    });
    this.track.addEventListener('mousedown', function (e) {
      e = e || window.event;
      that.mousedown = true;
      that.sliderdown = true;
      that.setPosition(e, false);
    });
    this.thumb.addEventListener('mousedown', function (e) {
      e = e || window.event;
      that.mousedown = true;
      that.sliderdown = true;
      that.setPosition(e, false);
    });

    /*
     * Event Listeners for Touch Interface
     * Using preventDefault here causes Chrome to throw a "violation". Blocking
     * the default behavior for touch is said to cause performance issues.
     * However, if you don't use preventDefault, people will also slide the
     * screen when using the slider which would be weird.
     */
    this.container.addEventListener('touchstart', function (e) {
      e = e || window.event;
      e.preventDefault();
      e.stopPropagation();
      that.setPosition(e, false);

      this.addEventListener('touchmove', function (e) {
        e = e || window.event;
        e.preventDefault();
        e.stopPropagation();
        that.setPosition(e, false);
      });
    });
    this.container.addEventListener('touchend', function (e) {
      e = e || window.event;
      e.preventDefault();
      e.stopPropagation();
      that.snap();
    });

    // Event Listeners for Keyboard on handle to move in percentage steps
    this.thumb.addEventListener('keydown', function (e) {
      e = e || window.event;
      var key = e.which || e.keyCode;
      // handler left
      if (key === 37 && (that.keydown === false || that.keydown === 37)) {
        that.keydown = 37;
        that.setPosition(that.getPosition() - 0.01 * parseInt(that.getWidth()), false);
      }
      // handler right
      if (key === 39 && (that.keydown === false || that.keydown === 39)) {
        that.keydown = 39;
        that.setPosition(that.getPosition() + 0.01 * parseInt(that.getWidth()), false);
      }
    });

    // Event Listeners for Keyboard to stop moving
    this.thumb.addEventListener('keyup', function (e) {
      e = e || window.event;
      that.snap();
      that.keydown = false;
    });

    // Initialize event inheritance
    H5P.EventDispatcher.call(this);
  };

  // Extends the event dispatcher
  Agamotto.Slider.prototype = Object.create(H5P.EventDispatcher.prototype);
  Agamotto.Slider.prototype.constructor = Agamotto.Slider;

  /**
   * Get the DOM elements.
   * @return {object} The DOM elements.
   */
  Agamotto.Slider.prototype.getDOM = function () {
    return this.container;
  };

  /**
   * Disable the slider
   */
  Agamotto.Slider.prototype.disable = function () {
    this.track.classList.add('h5p-agamotto-disabled');
    this.thumb.classList.add('h5p-agamotto-disabled');
  };

  /**
   * Enable the slider.
   */
  Agamotto.Slider.prototype.enable = function () {
    this.track.classList.remove('h5p-agamotto-disabled');
    this.thumb.classList.remove('h5p-agamotto-disabled');
  };

  /**
   * Set the slider's width.
   * @param {number} value - Slider's width.
   */
  Agamotto.Slider.prototype.setWidth = function (value) {
    this.trackWidth = value;
    this.track.style.width = value + 'px';
  };

  /**
   * Get the slider's width.
   * @return {number} Slider's width.
   */
  Agamotto.Slider.prototype.getWidth = function () {
    return this.trackWidth;
  };

  /**
   * Set the position of the thumb on the slider track.
   * @param {number} position - Position on the slider track from 0 to max.
   * @param {boolean} animate - If true, slide instead of jumping.
   * @param {boolean} resize - If true, won't recompute position/width ratio.
   */
  Agamotto.Slider.prototype.setPosition = function setPosition (position, animate, resize) {
    if (this.thumb.classList.contains('h5p-agamotto-disabled')) {
      return;
    }

    // Compute position from string (e.g. 1px), from number (e.g. 1), or from event
    if ((typeof position === 'string') || (typeof position === 'number')) {
      position = parseInt(position);
    }
    else if (typeof position === 'object') {
      if ((this.mousedown === false) && (position.type === 'mousemove')) {
        return;
      }

      position = this.getPointerX(position) -
        Agamotto.Slider.TRACK_OFFSET -
        parseInt(window.getComputedStyle(this.container).marginLeft) -
        parseInt(window.getComputedStyle(document.querySelector(this.selector)).paddingLeft) -
        parseInt(window.getComputedStyle(document.querySelector(this.selector)).marginLeft);
    }
    else {
      position = 0;
    }
    position = Agamotto.constrain(position, 0, this.getWidth());

    // Transition control
    if (animate === true) {
      this.thumb.classList.add('h5p-agamotto-transition');
    } else {
      this.thumb.classList.remove('h5p-agamotto-transition');
    }

    // We need to keep a fixed ratio not influenced by resizing
    if (!resize) {
      this.ratio = position / this.getWidth();
    }

    // Update DOM
    this.thumb.style.left = position + Agamotto.Slider.THUMB_OFFSET + 'px';
    var percentage = Math.round(position / this.getWidth() * 100);
    this.container.setAttribute('aria-valuenow', percentage);

    // Inform parent node
    this.trigger('update', {
      position: position,
      percentage: percentage
    });
  };

  /**
   * Get the current slider position.
   * @return {number} Current slider position.
   */
  Agamotto.Slider.prototype.getPosition = function () {
    return (this.thumb.style.left) ? parseInt(this.thumb.style.left) - Agamotto.Slider.THUMB_OFFSET : 0;
  };

  /**
   * Snap slider to closest tick position.
   */
  Agamotto.Slider.prototype.snap = function () {
    if (this.options.snap === true) {
      var snapIndex = Math.round(Agamotto.map(this.ratio, 0, 1, 0, this.options.size));
      this.setPosition(snapIndex * this.getWidth() / this.options.size, true);
    }
    // Only trigger on mouseup that was started by mousedown over slider
    if (this.sliderdown === true) {
      // Won't pass object and context if invoked by Agamotto.prototype.xAPI...()
      // Trigger xAPI when interacted with content
      this.parent.xAPIInteracted();
      // Will check if interaction was completed before triggering
      this.parent.xAPICompleted();
      // release interaction trigger
      this.sliderdown = false;
    }
  };

  /**
   * Get the horizontal position of the pointer/finger.
   * @param {Event} e - Delivering event.
   * @return {number} Horizontal pointer/finger position.
   */
  Agamotto.Slider.prototype.getPointerX = function (e) {
    var pointerX = 0;
    if (e.touches) {
      pointerX = e.touches[0].pageX;
    }
    else {
      pointerX = e.clientX;
    }
    return pointerX;
  };

  /**
   * Resize the slider.
   */
  Agamotto.Slider.prototype.resize = function () {
    this.setWidth(parseInt(this.container.offsetWidth) - 2 * Agamotto.Slider.TRACK_OFFSET);
    this.setPosition(this.getWidth() * this.ratio, false, true);

    var i = 0;
    // Update ticks
    if (this.options.ticks === true) {
      for (i = 0; i < this.ticks.length; i++) {
        this.ticks[i].style.left = Agamotto.Slider.TRACK_OFFSET + i * this.getWidth() / (this.ticks.length - 1) + 'px';
      }
    }
    // Height to enlarge the slider container
    var maxLabelHeight = 0;
    var overlapping = false;

    // Update labels
    if (this.options.labels === true) {
      for (i = 0; i < this.labels.length; i++) {
        maxLabelHeight = Math.max(maxLabelHeight, parseInt(window.getComputedStyle(this.labels[i]).height));

        // Align the first and the last label left/right instead of centered
        switch(i) {
            case (0):
              // First label
              this.labels[i].style.left = (Agamotto.Slider.TRACK_OFFSET / 2) + 'px';
              break;
            case (this.labels.length - 1):
              // Last label
              this.labels[i].style.right = (Agamotto.Slider.TRACK_OFFSET / 2) + 'px';
              break;
            default:
              // Centered over tick mark position
              var offset = Math.ceil(parseInt(window.getComputedStyle(this.labels[i]).width)) / 2;
              this.labels[i].style.left = Agamotto.Slider.TRACK_OFFSET + i * this.getWidth() / (this.labels.length - 1) - offset + 'px';
        }

        // Detect overlapping labels
        if (i < this.labels.length - 1 && !overlapping) {
          overlapping = (this.areOverlapping(this.labels[i], this.labels[i+1]));
        }
      }

      // Hide labels if some of them overlap and remove their vertical space
      if (overlapping) {
        this.labels.forEach(function (label) {
          label.classList.add('h5p-agamotto-hidden');
        });
        maxLabelHeight = 0;
      }
      else {
        this.labels.forEach(function (label) {
          label.classList.remove('h5p-agamotto-hidden');
        });
      }

      // If there are no ticks, put the labels a little closer to the track
      var buffer = (this.options.ticks === true || overlapping || maxLabelHeight === 0) ? 0 : -7;

      // Update slider height
      this.container.style.height = (Agamotto.Slider.CONTAINER_DEFAULT_HEIGHT + maxLabelHeight + buffer) + 'px';      }
  };

  /**
   * Detect overlapping labels
   * @param {object} label1 - Label 1.
   * @param {object} label2 - Label 2.
   * @return {boolean} True if labels are overlapping.
   */
  Agamotto.Slider.prototype.areOverlapping = function (label1, label2) {
    var rect1 = label1.getBoundingClientRect();
    var rect2 = label2.getBoundingClientRect();
    return !(rect1.right < rect2.left || rect1.left > rect2.right || rect1.bottom < rect2.top || rect1.top > rect2.bottom);
  };

})(H5P.Agamotto);
;
var H5P = H5P || {};

(function (Agamotto) {
  'use strict';

  var TAGS_FOR_PROPAGATION_STOPPING = ['A', 'EM', 'STRONG', 'SUB', 'SUP', 'SPAN'];

  /**
   * Descriptions object.
   *
   * @param {Object} texts - Array containing the texts for the images.
   * @param {string} selector - CSS class name of parent node.
   * @param {string} parent - Parent class Agamotto.
   */
  Agamotto.Descriptions = function (texts, selector, parent) {
    this.texts = texts;
    this.selector = selector;

    this.descriptionTop = document.createElement('div');
    this.descriptionTop.classList.add('h5p-agamotto-description-top');
    this.descriptionTop.style.opacity = 1;
    this.descriptionTop.setAttribute('tabindex', 0);
    this.descriptionTop.innerHTML = texts[0];

    this.descriptionBottom = document.createElement('div');
    this.descriptionBottom.classList.add('h5p-agamotto-description-bottom');
    this.descriptionBottom.style.opacity = 0;
    this.descriptionBottom.innerHTML = texts[1];

    this.descriptionsContainer = document.createElement('div');
    this.descriptionsContainer.classList.add('h5p-agamotto-descriptions-container');
    this.descriptionsContainer.appendChild(this.descriptionTop);
    this.descriptionsContainer.appendChild(this.descriptionBottom);

    // Necessary to override the EventListener on document
    this.descriptionsContainer.addEventListener('mouseup', function(e) {
      // Needed for allowing links to work (may contain markup such as strong)
      if (TAGS_FOR_PROPAGATION_STOPPING.indexOf(e.target.tagName) !== -1) {
        e.stopPropagation();
        // Won't pass object and context if invoked by Agamotto.prototype.xAPIInteracted()
        parent.xAPIInteracted();
      }
    });
  };

  Agamotto.Descriptions.prototype = {
    /**
     * Get DOM elements.
     * @return {object} DOM elements.
     */
    getDOM: function getDOM () {
      return this.descriptionsContainer;
    },

    /**
     * Set the description text.
     * @param {number} index - Description (image) index.
     * @param {number} opacity - Description (image) opacity, [0..1].
     */
    setText: function setText (index, opacity) {

      // Switch position to make selecting links possible, threshold is 0.5 opacity
      if (opacity > 0.5) {
        this.descriptionTop.innerHTML = this.texts[index];
        this.descriptionBottom.innerHTML = this.texts[Agamotto.constrain(index + 1, 0, this.texts.length - 1)];
        this.descriptionTop.style.opacity = opacity;
        this.descriptionBottom.style.opacity = 1 - opacity;
      }
      else {
        this.descriptionTop.innerHTML = this.texts[Agamotto.constrain(index + 1, 0, this.texts.length - 1)];
        this.descriptionBottom.innerHTML = this.texts[index];
        this.descriptionTop.style.opacity = 1 - opacity;
        this.descriptionBottom.style.opacity = opacity;
      }
    },
    /**
     * Adjust the height of the description area.
     */
    adjustHeight: function adjustHeight () {
      var that = this;
      // We need to determine the highest of all description texts for resizing
      var height = 0;
      this.texts.forEach(function (text) {
        that.descriptionBottom.innerHTML = text;
        height = Math.max(height, that.descriptionBottom.offsetHeight);
      });
      this.descriptionsContainer.style.height = height + 'px';
    }
  };

})(H5P.Agamotto);
;
/*
 * taylorhakes/promise-polyfill
 * Copyright (c) 2014 Taylor Hakes
 * Copyright (c) 2014 Forbes Lindesay
 * License: MIT License (https://opensource.org/licenses/MIT)
 * original source code: https://github.com/taylorhakes/promise-polyfill
 */
(function (root) {

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;

  function noop() {}

  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function () {
      fn.apply(thisArg, arguments);
    };
  }

  function Promise(fn) {
    if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    this._state = 0;
    this._handled = false;
    this._value = undefined;
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    Promise._immediateFn(function () {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then;
        if (newValue instanceof Promise) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) {
      reject(self, e);
    }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    if (self._state === 2 && self._deferreds.length === 0) {
      Promise._immediateFn(function() {
        if (!self._handled) {
          Promise._unhandledRejectionFn(self._value);
        }
      });
    }

    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  function Handler(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        resolve(self, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise.prototype['catch'] = function (onRejected) {
    return this.then(null, onRejected);
  };

  Promise.prototype.then = function (onFulfilled, onRejected) {
    var prom = new (this.constructor)(noop);

    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise.all = function (arr) {
    var args = Array.prototype.slice.call(arr);

    return new Promise(function (resolve, reject) {
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(val, function (val) {
                res(i, val);
              }, reject);
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise.resolve = function (value) {
    if (value && typeof value === 'object' && value.constructor === Promise) {
      return value;
    }

    return new Promise(function (resolve) {
      resolve(value);
    });
  };

  Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
      reject(value);
    });
  };

  Promise.race = function (values) {
    return new Promise(function (resolve, reject) {
      for (var i = 0, len = values.length; i < len; i++) {
        values[i].then(resolve, reject);
      }
    });
  };

  // Use polyfill for setImmediate for performance gains
  Promise._immediateFn = (typeof setImmediate === 'function' && function (fn) { setImmediate(fn); }) ||
    function (fn) {
      setTimeoutFunc(fn, 0);
    };

  Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
    if (typeof console !== 'undefined' && console) {
      console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
    }
  };

  /**
   * Set the immediate function to execute callbacks
   * @param fn {function} Function to execute
   * @deprecated
   */
  Promise._setImmediateFn = function _setImmediateFn(fn) {
    Promise._immediateFn = fn;
  };

  /**
   * Change the function to execute on unhandled rejection
   * @param {function} fn Function to execute on unhandled rejection
   * @deprecated
   */
  Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
    Promise._unhandledRejectionFn = fn;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Promise;
  } else if (!root.Promise) {
    root.Promise = Promise;
  }

})(this);
;
