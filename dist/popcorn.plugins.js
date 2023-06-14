/**
* Pause Popcorn Plug-in
*
* When this plugin is used, links on the webpage, when clicked, will pause
* popcorn videos that especified 'pauseOnLinkClicked' as an option. Links may
* cause a new page to display on a new window, or may cause a new page to
* display in the current window, in which case the videos won't be available
* anymore. It only affects anchor tags. It does not affect objects with click
* events that act as anchors.
*
* Example:
 var p = Popcorn('#video', { pauseOnLinkClicked : true } )
   .play();
*
*/

document.addEventListener( "click", function( event ) {

  var targetElement = event.target;

  //Some browsers use an element as the target, some use the text node inside
  if ( targetElement.nodeName === "A" || targetElement.parentNode && targetElement.parentNode.nodeName === "A" ) {
    Popcorn.instances.forEach( function( video ) {
      if ( video.options.pauseOnLinkClicked ) {
        video.pause();
      }
    });
  }
}, false );
// PLUGIN: WIKIPEDIA
(function ( Popcorn ) {

  /**
   * Wikipedia popcorn plug-in
   * Displays a wikipedia aricle in the target specified by the user by using
   * a new DOM element inserted into target. The article HTML will be stripped of images,
   * table of contents, and certain other features.
   * Options parameters include start, end, target, lang, src, title and paragraphs.
   * -Start is the time that you want this plug-in to execute (required)
   * -End is the time that you want this plug-in to stop executing (required)
   * -Target is the id of the document element that the text from the article needs to be
   * attached to, this target element must exist on the DOM 
   * -Lang (optional, defaults to english) is the language in which the article is in.
   * -Src is the url of the article
   * -Title (optional) is the title of the article
   * -paragraphs (optional, defaults to 6) is the number of paragraphs to display
   *
   * @param {Object} options
   *
   * Example:
     var p = Popcorn("#video")
        .wikipedia({
          start: 5, // seconds
          end: 15, // seconds
          src: "http://en.wikipedia.org/wiki/Cape_Town",
          target: "wikidiv"
        } )
   *
   */

  // using a counter here to keep track of invocations
  // would be nice to have a different way to do this, but this seems to be the practice
  // in other plugins
  let i = 1;

  // not using DOMParser any more!
  // let domParser = new DOMParser();
  // fetch json response asynchronously
  async function getWiki ( page, lang="en" ) {
    let url = `https://${lang}.wikipedia.org/w/api.php?origin=*&action=parse&format=json&redirects&page=${page}`;
    return await fetch(url)
      .then(function(response){return response.json();})
      .then(function(response) {
        return response.parse;
    })
    .catch(function(error){console.log(error);});
  }

  Popcorn.plugin( "wikipedia" , function (options) {
  
    // let newdiv,
    //     target = document.getElementById( options.target );
    // newdiv.style.width = "100%";
    // newdiv.style.height = "100%";

    return {

     /**
     * @member wikipedia
     * The setup function will get all of the needed
     * items in place before the start function is called.
     * This includes getting data from wikipedia, if the data
     * is not received and processed before start is called start
     * will not do anything
     */
      _setup : async function( options ) {
        // if the user didn't specify a language default to english
        if ( !options.lang ) {
          options.lang = "en";
        }

        // if the user didn't specify number of paragraphs to use default to 6
        options.paragraphs  = options.paragraphs || 6;
        options.src = options.src || options._natives.manifest.options.src[ "default" ];
        let pageName = options.src.slice( options.src.lastIndexOf( "/" ) + 1 );

        // fetch data from Wikipedia; if successful, process. 
        let apiResp = await getWiki(pageName, options.lang);
        if (apiResp && apiResp.text["*"] ) {
          let _text = apiResp.text["*"];
          // munge internal links -- hopefully catches all common uses 
          _text = _text.replace(/href=\"\/wiki\//g, `href="https://${options.lang}.wikipedia.org/wiki/`);
          _text = _text.replace(/src=\"\/\//g,`src="https://` );

          // create a container
          // 
          options._container = document.createElement( "div" );
          options._container.id = "wikidiv" + i;
          i++;
          options.container.classList.add("wikipedia-plugin");
          options._container.innerHTML = `<h1><a href="${options.src} target="_blank">${options.title || apiResp.title}</a></h1>`;
          
          // insert the content of the wiki article
          options._container.innerHTML += _text;

          // strip these page elements from rendered html.  At present includes:
          // - editorial notes e.g. about redirects or altenrate spellings, or problems w/ page
          // - tables of ocntents, and all other tables!
          // - "Edit" links in section headers
          // - all image galleries, and other images as well
          // - empty paragraph that is for some reason usually included in output
          let removes = ['div[role="note"]', 'p.mw-empty-elt', 'table', 'div#toc', 'div.thumb', 'span.mw-editsection', 'img', 'sup.reference', 'ul.gallery'];
          for (let r of removes) {
            let note = options._container.querySelectorAll(r);
            if (note) {
              note.forEach (function (n){
                n.parentNode.removeChild(n)});
            }
          }

          // now cut down the article to n paragraphs
          // use general sibling sleector and `NodeList.forEach()` to remove additional content 
          let qString = `div.mw-parser-output p:nth-of-type(${options.paragraphs}) ~ *`;
          
          let extras = options._container.querySelectorAll(qString);
          extras.forEach ( (el) => el.remove());
          
          // hmm.  would be better served w/ a promise or await, but works for now.  
          options._fired = true;
        }


      },
      /**
       * @member wikipedia
       * The start function will be executed when the currentTime
       * of the video  reaches the start time provided by the
       * options variable
       */
      start: function( event, options ){
        // dont do anything if the information didn't come back from wiki
        // might be better to use use `await` but I'm not yet sure if async functions
        // work for `start` and `end` in popcorn plugins
        var isReady = function () {

          // primitive hack from pre-async days. 
          if ( !options._fired ) {
            setTimeout( function () {
              isReady();
            }, 13);
          } else {

            if ( options._container  && document.getElementById (options.target)) {
                document.getElementById( options.target ).appendChild( options._container );
                options._added = true;
            }
          }
        };
        isReady();
      },
      /**
       * @member wikipedia
       * The end function will be executed when the currentTime
       * of the video  reaches the end time provided by the
       * options variable
       */
      end: function( event, options ){
        // ensure that the data was actually added to the
        // DOM before removal
        if ( options._added ) {
          document.getElementById( options.target ).removeChild( options._container );
        }
      },

      _teardown: function( options ){

        if ( options._added ) {
          options._link.parentNode && document.getElementById( options.target ).removeChild( options._link );
          options._desc.parentNode && document.getElementById( options.target ).removeChild( options._desc );
          delete options.target;
        }
      }
    };
  },
    {
      about:{
        name: "Popcorn Wikipedia Plugin",
        version: "0.2",
        author: "@annasob, @titaniumbones",
        website: "https://annasob.wordpress.com"
      },
      options:{
        start: {
          elem: "input",
          type: "number",
          label: "Start"
        },
        end: {
          elem: "input",
          type: "number",
          label: "End"
        },
        lang: {
          elem: "input",
          type: "text",
          label: "Language",
          "default": "english",
          optional: true
        },
        src: {
          elem: "input", 
          type: "url", 
          label: "Wikipedia URL",
          "default": "http://en.wikipedia.org/wiki/Cat"
        },
        title: {
          elem: "input",
          type: "text",
          label: "Title",
          "default": "Cats",
          optional: true
        },
        paragraphs: {
          elem: "input",
          type: "number",
          label: "Number of Paragraphs",
          "default": "3",
          optional: true
        },
        target: "wikipedia-container"
      }
    },
    /**
     * @member wikipedia
     * The setup function will get all of the needed
     * items in place before the start function is called.
     * This includes getting data from wikipedia, if the data
     * is not received and processed before start is called start
     * will not do anything
     */
    _setup : function( options ) {
      // declare needed variables
      // get a guid to use for the global wikicallback function
      var  _text, _guid = Popcorn.guid();

      // if the user didn't specify a language default to english
      if ( !options.lang ) {
        options.lang = "en";
      }

      // if the user didn't specify number of words to use default to 200
      options.numberofwords  = options.numberofwords || 200;

      // wiki global callback function with a unique id
      // function gets the needed information from wikipedia
      // and stores it by appending values to the options object
      window[ "wikiCallback" + _guid ]  = function ( data ) {

        options._link = document.createElement( "a" );
        options._link.setAttribute( "href", options.src );
        options._link.setAttribute( "target", "_blank" );

        // add the title of the article to the link
        options._link.innerHTML = options.title || data.parse.displaytitle;

        // get the content of the wiki article
        options._desc = document.createElement( "p" );

        // get the article text and remove any special characters
        _text = data.parse.text[ "*" ].substr( data.parse.text[ "*" ].indexOf( "<p>" ) );
        _text = _text.replace( /((<(.|\n)+?>)|(\((.*?)\) )|(\[(.*?)\]))/g, "" );

        _text = _text.split( " " );
        options._desc.innerHTML = ( _text.slice( 0, ( _text.length >= options.numberofwords ? options.numberofwords : _text.length ) ).join (" ") + " ..." ) ;

        options._fired = true;
      };

      if ( options.src ) {
        Popcorn.getScript( "//" + options.lang + ".wikipedia.org/w/api.php?action=parse&prop=text&redirects&page=" +
          options.src.slice( options.src.lastIndexOf( "/" ) + 1 )  + "&format=json&callback=wikiCallback" + _guid );
      }

      options.toString = function() {
        return options.src || options._natives.manifest.options.src[ "default" ];
      };
    },
    /**
     * @member wikipedia
     * The start function will be executed when the currentTime
     * of the video  reaches the start time provided by the
     * options variable
     */
    start: function( event, options ){
      // dont do anything if the information didn't come back from wiki
      var isReady = function () {

        if ( !options._fired ) {
          setTimeout( function () {
            isReady();
          }, 13);
        } else {

          if ( options._link && options._desc ) {
            if ( document.getElementById( options.target ) ) {
              document.getElementById( options.target ).appendChild( options._link );
              document.getElementById( options.target ).appendChild( options._desc );
              options._added = true;
            }
          }
        }
      };

      isReady();
    },
    /**
     * @member wikipedia
     * The end function will be executed when the currentTime
     * of the video  reaches the end time provided by the
     * options variable
     */
    end: function( event, options ){
      // ensure that the data was actually added to the
      // DOM before removal
      if ( options._added ) {
        document.getElementById( options.target ).removeChild( options._link );
        document.getElementById( options.target ).removeChild( options._desc );
      }
    },

    _teardown: function( options ){

      if ( options._added ) {
        options._link.parentNode && document.getElementById( options.target ).removeChild( options._link );
        options._desc.parentNode && document.getElementById( options.target ).removeChild( options._desc );
        delete options.target;
      }
    }
  });

}) ( Popcorn );
// PLUGIN: Flickr
(function (Popcorn) {

  /**
   * Flickr popcorn plug-in
   * Appends a users Flickr images to an element on the page.
   * Options parameter will need a start, end, target and userid or username and api_key.
   * Optional parameters are numberofimages, height, width, padding, and border
   * Start is the time that you want this plug-in to execute (in seconds)
   * End is the time that you want this plug-in to stop executing (in seconds)
   * Userid is the id of who's Flickr images you wish to show
   * Tags is a mutually exclusive list of image descriptor tags
   * Username is the username of who's Flickr images you wish to show
   *  using both userid and username is redundant
   *  an api_key is required when using username
   * Apikey is your own api key provided by Flickr
   * Target is the id of the document element that the images are
   *  appended to, this target element must exist on the DOM
   * Numberofimages specify the number of images to retreive from flickr, defaults to 4
   * Height the height of the image, defaults to '50px'
   * Width the width of the image, defaults to '50px'
   * Padding number of pixels between images, defaults to '5px'
   * Border border size in pixels around images, defaults to '0px'
   *
   * @param {Object} options
   *
   * Example:
     var p = Popcorn('#video')
        .flickr({
          start:          5,                 // seconds, mandatory
          end:            15,                // seconds, mandatory
          userid:         '35034346917@N01', // optional
          tags:           'dogs,cats',       // optional
          numberofimages: '8',               // optional
          height:         '50px',            // optional
          width:          '50px',            // optional
          padding:        '5px',             // optional
          border:         '0px',             // optional
          target:         'flickrdiv'        // mandatory
        } )
   *
   */

  var idx = 0;

  Popcorn.plugin( "flickr" , function( options ) {
    var containerDiv,
        target = document.getElementById( options.target ),
        _userid,
        _uri,
        _link,
        _image,
        _count = options.numberofimages || 4,
        _height = options.height || "50px",
        _width = options.width || "50px",
        _padding = options.padding || "5px",
        _border = options.border || "0px";

    // create a new div this way anything in the target div is left intact
    // this is later populated with Flickr images
    containerDiv = document.createElement( "div" );
    containerDiv.id = "flickr" + idx;
    containerDiv.style.width = "100%";
    containerDiv.style.height = "100%";
    containerDiv.style.display = "none";
    idx++;

    target && target.appendChild( containerDiv );

    // get the userid from Flickr API by using the username and apikey
    var isUserIDReady = function() {
      if ( !_userid ) {

        _uri  = "https://api.flickr.com/services/rest/?method=flickr.people.findByUsername&";
        _uri += "username=" + options.username + "&api_key=" + options.apikey + "&format=json&jsoncallback=flickr";
        Popcorn.getJSONP( _uri, function( data ) {
          _userid = data.user.nsid;
          getFlickrData();
        });

      } else {

        setTimeout(function () {
          isUserIDReady();
        }, 5 );
      }
    };

    // get the photos from Flickr API by using the user_id and/or tags
    var getFlickrData = function() {

      _uri  = "http://api.flickr.com/services/feeds/photos_public.gne?";

      if ( _userid ) {
        _uri += "id=" + _userid + "&";
      }
      if ( options.tags ) {
        _uri += "tags=" + options.tags + "&";
      }

      _uri += "lang=en-us&format=json&jsoncallback=flickr";

      Popcorn.xhr.getJSONP( _uri, function( data ) {

        var fragment = document.createElement( "div" );

        fragment.innerHTML = "<p style='padding:" + _padding + ";'>" + data.title + "<p/>";

        Popcorn.forEach( data.items, function ( item, i ) {
          if ( i < _count ) {

            _link = document.createElement( "a" );
            _link.setAttribute( "href", item.link );
            _link.setAttribute( "target", "_blank" );
            _image = document.createElement( "img" );
            _image.setAttribute( "src", item.media.m );
            _image.setAttribute( "height",_height );
            _image.setAttribute( "width", _width );
            _image.setAttribute( "style", "border:" + _border + ";padding:" + _padding );
            _link.appendChild( _image );
            fragment.appendChild( _link );

          } else {

            return false;
          }
        });

        containerDiv.appendChild( fragment );
      });
    };

    if ( options.username && options.apikey ) {
      isUserIDReady();
    }
    else {
      _userid = options.userid;
      getFlickrData();
    }

    options.toString = function() {
      return options.tags || options.username || "Flickr";
    };

    return {
      /**
       * @member flickr
       * The start function will be executed when the currentTime
       * of the video reaches the start time provided by the
       * options variable
       */
      start: function( event, options ) {
        containerDiv.style.display = "inline";
      },
      /**
       * @member flickr
       * The end function will be executed when the currentTime
       * of the video reaches the end time provided by the
       * options variable
       */
      end: function( event, options ) {
        containerDiv.style.display = "none";
      },
      _teardown: function( options ) {
        document.getElementById( options.target ) && document.getElementById( options.target ).removeChild( containerDiv );
      }
    };
  },
  {
    about: {
      name: "Popcorn Flickr Plugin",
      version: "0.2",
      author: "Scott Downe, Steven Weerdenburg, Annasob",
      website: "http://scottdowne.wordpress.com/"
    },
    options: {
      start: {
        elem: "input",
        type: "number",
        label: "Start"
      },
      end: {
        elem: "input",
        type: "number",
        label: "End"
      },
      userid: {
        elem: "input",
        type: "text",
        label: "User ID",
        optional: true
      },
      tags: {
        elem: "input",
        type: "text",
        label: "Tags"
      },
      username: {
        elem: "input",
        type: "text",
        label: "Username",
        optional: true
      },
      apikey: {
        elem: "input",
        type: "text",
        label: "API Key",
        optional: true
      },
      target: "flickr-container",
      height: {
        elem: "input",
        type: "text",
        label: "Height",
        "default": "50px",
        optional: true
      },
      width: {
        elem: "input",
        type: "text",
        label: "Width",
        "default": "50px",
        optional: true
      },
      padding: {
        elem: "input",
        type: "text",
        label: "Padding",
        optional: true
      },
      border: {
        elem: "input",
        type: "text",
        label: "Border",
        "default": "5px",
        optional: true
      },
      numberofimages: {
        elem: "input",
        type: "number",
        "default": 4,
        label: "Number of Images"
      }
    }
  });
})( Popcorn );
// PLUGIN: Markdown

(function ( Popcorn ) {

  /**
   * Markdown Popcorn Plug-in
   *
   * Adds the ability to render Markdown using markdown-it on the fly rendering.
   * Largely copied from Mustache plugin by David Humphrey.
   *
   * In initial form, uses opinionated defaults consistent with student expectations in
   * https://github.com/DigitalHistory/advanced-topics. We therefore enable tables & use
   * `attrs`, `emoji`, and `footnote` plugins.
   *
   * @param {Object} options
   *
   * Required parameters: start, end, markdown, and target.
   *
   *   start: the time in seconds when the markdown template should be rendered
   *          in the target div.
   *
   *   end: the time in seconds when the rendered markdown template should be
   *        removed from the target div.
   *
   *   target: a String -- the target div's id.
   *
   *   text: the markdown text to be rendered using the markdown template.  Should be a string.
   *
   *
   * Example:
     var p = Popcorn('#video')

        // Example using strings.
        .markdown({
          start: 5, // seconds
          end:  15,  // seconds
          target: 'markdown',
          markdown: `## Header 2
Paragraph with **bold** _ital_ and :rocket: emoji`
        } )

  *
  */

  
  // I don't really understand what this external scope context is, but it seems I can
  // set some variables out here which will persist across all the markdown plugin instances
  // and that let works as well as var.
  // It also doesn't seem to pollute the global scope.
  let i = 0;
  
  Popcorn.plugin( "markdown" , function( options ){

    var markdown;

    Popcorn.getScript( "https://cdnjs.cloudflare.com/ajax/libs/markdown-it/10.0.0/markdown-it.js",
                       function () {
                         Popcorn.getScript("https://cdn.jsdelivr.net/npm/markdown-it-attrs@2.3.2/markdown-it-attrs.browser.js");
                         Popcorn.getScript("https://cdn.jsdelivr.net/npm/markdown-it-footnote@3.0.1/dist/markdown-it-footnote.min.js");
                         Popcorn.getScript("https://cdn.jsdelivr.net/npm/markdown-it-emoji@1.4.0/dist/markdown-it-emoji.js");
                       });

    var target = document.getElementById( options.target );

    let newdiv;
    
    newdiv = document.createElement( "div" );
    newdiv.id = "markdowndiv" + i;
    newdiv.classList.add("markdown-plugin");
    newdiv.style.display = "none";
    i++;
    if (target)
    {target.appendChild( newdiv );}

    markdown = options.text || "" ;
    
    options.container = target || document.createElement( "div" );

    return {
      start: function( event, options ) {
        
        var interval = function() {

          if( !window.markdownitEmoji || !window.markdownitFootnote || !window.markdownItAttrs ) {
            // console.log ('markdownit tests fail');
            // console.log(window.markdownitEmoji);
            // console.log(window.markdownitFootnote);
            // console.log(window.markdownItAttrs);
            setTimeout( function() {
              interval();
            }, 100 );
          } else {
            // console.log("md should have all plugins loaded")
            let parser = window.markdownit('commonmark', {
              html: true,
              linkify: true});
            /* use footnote, attribute and emoji plugins */
            parser.use(window.markdownItAttrs);
            parser.use(window.markdownitFootnote);
            parser.use(window.markdownitEmoji);
            /* enable tables */
            parser.enable('table');
            
            let html = parser.render( markdown
                                       ).replace( /^\s*/mg, "" );
            newdiv.innerHTML = html;
            newdiv.style.display = "block";
          }
        };

        interval();

      },

      end: function( event, options ) {
        //newdiv.innerHTML = "";
        newdiv.style.display = "none";
      },
      _teardown: function( options ) {
        markdown = null;
      }
    };
  },
  {
    about: {
      name: "Popcorn Markdown Plugin",
      version: "0.1",
      author: "David Humphrey (@humphd), Matt Price (@titaniumbones)",
      website: "https://github.com/DigitalHistory"
    },
    options: {
      start: {
        elem: "input",
        type: "number",
        label: "Start"
      },
      end: {
        elem: "input",
        type: "number",
        label: "End"
      },
      target: "markdown-container",
      text: {
        elem: "input",
        type: "text",
        label: "Markdown Text"
      }
    }
  });
})( Popcorn );
// PLUGIN: FIGURE

(function ( Popcorn ) {

/**
 * Figures popcorn plug-in
 * Shows an figure element
 * Options parameter will need a start, end, href, target and src.
 * Start is the time that you want this plug-in to execute
 * End is the time that you want this plug-in to stop executing
 * href is the url of the destination of a anchor - optional
 * Target is the id of the document element that the iframe needs to be attached to,
 * this target element must exist on the DOM
 * Src is the url of the image that you want to display
 * text is the overlayed text on the figure - optional
 *
 * @param {Object} options
 *
 * Example:
   var p = Popcorn('#video')
      .figure({
        start: 5, // seconds
        end: 15, // seconds
        href: 'http://www.drumbeat.org/',
        src: 'http://www.drumbeat.org/sites/default/files/domain-2/drumbeat_logo.png',
        text: 'DRUMBEAT',
        target: 'figurediv'
      } )
 *
 */

  let i=0;

  Popcorn.plugin( "figure", function (options) {

    return {
      _setup: function( options ) {
        // console.log(options);
      let figure = options.figure =  document.createElement( "figure" ),
          img = document.createElement( "img" ),
          target = document.getElementById( options.target );
      figure.appendChild(img);
      figure.style.display = "none";
      figure.classList.add("figure-plugin");
      figure.id = options.id || `popcorn-figure${i}`;
      i++;
      if (options.text) {
        let caption = document.createElement ("figcaption");
        caption.innerHTML = options.text;
        figure.appendChild(caption);
      }
        // options.anchor = document.createElement( "a" );
        // options.anchor.style.position = "relative";
        // options.anchor.style.textDecoration = "none";
        // options.anchor.style.display = "none";

        // add the widget's div to the target div.
        // if target is <video> or <audio>, create a container and routinely
        // update its size/position to be that of the media
        if ( target ) {
            target.appendChild( options.figure );
        }


        img.src = options.src;

        // options.toString = function() {
        //   var string = options.src || options._natives.manifest.options.src[ "default" ],
        //       match = string // .replace( /.*\//g, "" );
        //   return match.length ? match : string;
        // };
      },

      /**
       * @member figure
       * The start function will be executed when the currentTime
       * of the video  reaches the start time provided by the
       * options variable
       */
    start: function( event, options ) {
      // options.anchor.style.display = "inline";
      options.figure.style.display = "block";
      },
      /**
       * @member figure
       * The end function will be executed when the currentTime
       * of the video  reaches the end time provided by the
       * options variable
       */
      end: function( event, options ) {
        options.figure.style.display = "none";
      },
      _teardown: function( options ) {
        if ( options.trackedContainer ) {
          options.trackedContainer.destroy();
        }
        else if ( options.anchor.parentNode ) {
          options.figure.parentNode.removeChild( options.figure );
        }
      }
    };
  },
                  
  {
    about: {
      name: "Popcorn Figure Plugin",
      version: "0.1",
      author: "Scott Downe, Matt Price",
      website: "http://scottdowne.wordpress.com/"
    },
    options: {
      start: {
        elem: "input",
        type: "number",
        label: "Start"
      },
      end: {
        elem: "input",
        type: "number",
        label: "End"
      },
      src: {
        elem: "input",
        type: "url",
        label: "Figure URL",
        "default": "http://mozillapopcorn.org/wp-content/themes/popcorn/images/for_developers.png"
      },
      href: {
        elem: "input",
        type: "url",
        label: "Link",
        "default": "http://mozillapopcorn.org/wp-content/themes/popcorn/images/for_developers.png",
        optional: true
      },
      id: {
        elem: "input",
        type: "text",
        label: "Figure ID",
        optional: true
      },
      target: "figure-container",
      text: {
        elem: "input",
        type: "text",
        label: "Caption",
        "default": "popcorn-container",
        optional: true
      }
    }
  });
})( Popcorn );
// PLUGIN: Code

(function ( Popcorn ) {

  /**
   * Code Popcorn Plug-in
   *
   * Adds the ability to run arbitrary code (JavaScript functions) according to video timing.
   *
   * @param {Object} options
   *
   * Required parameters: start, end, template, data, and target.
   * Optional parameter: static.
   *
   *   start: the time in seconds when the mustache template should be rendered
   *          in the target div.
   *
   *   end: the time in seconds when the rendered mustache template should be
   *        removed from the target div.
   *
   *   onStart: the function to be run when the start time is reached.
   *
   *   onFrame: [optional] a function to be run on each paint call
   *            (e.g., called ~60 times per second) between the start and end times.
   *
   *   onEnd: [optional] a function to be run when the end time is reached.
   *
   * Example:
     var p = Popcorn('#video')

        // onStart function only
        .code({
          start: 1,
          end: 4,
          onStart: function( options ) {
            // called on start
          }
        })

        // onStart + onEnd only
        .code({
          start: 6,
          end: 8,
          onStart: function( options ) {
            // called on start
          },
          onEnd: function ( options ) {
            // called on end
          }
        })

        // onStart, onEnd, onFrame
        .code({
          start: 10,
          end: 14,
          onStart: function( options ) {
            // called on start
          },
          onFrame: function ( options ) {
            // called on every paint frame between start and end.
            // uses mozRequestAnimationFrame, webkitRequestAnimationFrame,
            // or setTimeout with 16ms window.
          },
          onEnd: function ( options ) {
            // called on end
          }
        });
  *
  */

  Popcorn.plugin( "code" , function( options ) {
    var running = false,
        instance = this;

    // Setup a proper frame interval function (60fps), favouring paint events.
    var step = (function() {

      var buildFrameRunner = function( runner ) {
        return function( f, options ) {

          var _f = function() {
            running && f.call( instance, options );
            running && runner( _f );
          };

          _f();
        };
      };

      // Figure out which level of browser support we have for this
      if ( window.webkitRequestAnimationFrame ) {
        return buildFrameRunner( window.webkitRequestAnimationFrame );
      } else if ( window.mozRequestAnimationFrame ) {
        return buildFrameRunner( window.mozRequestAnimationFrame );
      } else {
        return buildFrameRunner( function( f ) {
          window.setTimeout( f, 16 );
        });
      }

    })();

    if ( !options.onStart || typeof options.onStart !== "function" ) {

      options.onStart = Popcorn.nop;
    }

    if ( options.onEnd && typeof options.onEnd !== "function" ) {

      options.onEnd = undefined;
    }

    if ( options.onFrame && typeof options.onFrame !== "function" ) {

      options.onFrame = undefined;
    }

    return {
      start: function( event, options ) {
        options.onStart.call( instance, options );

        if ( options.onFrame ) {
          running = true;
          step( options.onFrame, options );
        }
      },

      end: function( event, options ) {
        if ( options.onFrame ) {
          running = false;
        }

        if ( options.onEnd ) {
          options.onEnd.call( instance, options );
        }
      }
    };
  },
  {
    about: {
      name: "Popcorn Code Plugin",
      version: "0.1",
      author: "David Humphrey (@humphd)",
      website: "http://vocamus.net/dave"
    },
    options: {
      start: {
       elem: "input",
       type: "number",
       label: "Start"
      },
      end: {
        elem: "input",
        type: "number",
        label: "End"
      },
      onStart: {
        elem: "input",
        type: "function",
        label: "onStart"
      },
      onFrame: {
        elem: "input",
        type: "function",
        label: "onFrame",
        optional: true
      },
      onEnd: {
        elem: "input",
        type: "function",
        label: "onEnd"
      }
    }
  });
})( Popcorn );
// PLUGIN: Wordriver

(function ( Popcorn ) {

  let container = {},
      spanLocation = 0,
      i = 0,
      setupContainer = function( target, container) {

        let element = document.createElement( "div" );

        var t = document.querySelector ( `#${target}`);
        t && t.appendChild( element );

        element.style.height = "100%";
        element.style.position = "relative";
        element.id = container;
        element.classList.add("wordriver-plugin");
        // console.log (container)
        return element;
      },
      // creates an object of supported, cross platform css transitions
      span = document.createElement( "span" ),
      prefixes = ["", "Moz", "webkit", "ms", "O" ],
      specProp = [ "Transform", "TransitionDuration", "TransitionTimingFunction" ],
      supports = {},
      prop;

  document.getElementsByTagName( "head" )[ 0 ].appendChild( span );

  // this will always break on unprefixed b/c of lowercase first letter
  // in those prop names.  oh well!
  for ( var sIdx = 0, sLen = specProp.length; sIdx < sLen; sIdx++ ) {
    for ( var pIdx = 0, pLen = prefixes.length; pIdx < pLen; pIdx++ ) {
      prop = prefixes[ pIdx ] + specProp[ sIdx ];
      if ( prop in span.style ) {
        supports[ specProp[ sIdx ].toLowerCase() ] = prop;
        break;
      }
    }
  }
  // console.log(supports);
  // Garbage collect support test span
  document.getElementsByTagName( "head" )[ 0 ].removeChild( span );

  /**
   * Word River popcorn plug-in
   * Displays a string of text, fading it in and out
   * while transitioning across the height of the parent container
   * for the duration of the instance  (duration = end - start)
   *
   * @param {Object} options
   *
   * Example:
     var p = Popcorn( '#video' )
        .wordriver({
          start: 5,                      // When to begin the Word River animation
          end: 15,                       // When to finish the Word River animation
          text: 'Hello World',           // The text you want to be displayed by Word River
          target: 'wordRiverDiv',        // The target div to append the text to
          color: "blue"                  // The color of the text. (can be Hex value i.e. #FFFFFF )
        } )
   *
   */

  Popcorn.plugin( "wordriver" , {

      manifest: {
        about:{
          name: "Popcorn WordRiver Plugin"
        },
        options: {
          start: {
            elem: "input",
            type: "number",
            label: "Start"
          },
          end: {
            elem: "input",
            type: "number",
            label: "End"
          },
          target: "wordriver-container",
          text: {
            elem: "input",
            type: "text",
            label: "Text",
            "default": "Popcorn.js"
          },
          color: {
            elem: "input",
            type: "text",
            label: "Color",
            "default": "Green",
            optional: true
          },
          id: {
            elem: "input",
            type: "text",
            label: "ID"
          }
        }
      },

      _setup: function( options ) {

        options._duration = options.end - options.start;

        // we're using the `id` in a strange way which allows the plugin to
        // reuse an existing wordriver if we want.
        // so we will check to see if this element exists before creating it
        options.id = options.id || `wordriver${i}`;
        i++;
        options._container =  document.querySelector (`#${options.target} #${options.id}`) || setupContainer( options.target, options.id );

        options.word = document.createElement( "span" );
        options.word.style.position = "absolute";

        options.word.style.whiteSpace = "nowrap";
        options.word.style.opacity = 0;

        options.word.style.MozTransitionProperty = "opacity, -moz-transform";
        options.word.style.webkitTransitionProperty = "opacity, -webkit-transform";
        options.word.style.OTransitionProperty = "opacity, -o-transform";
        options.word.style.transitionProperty = "opacity, transform";

        options.word.style[ supports.transitionduration ] = 1 + "s, " + options._duration + "s";
        options.word.style[ supports.transitiontimingfunction ] = "linear";

        options.word.innerHTML = options.text;
        options.word.style.color = options.color || "black";
      },
      start: function( event, options ){

        options._container.appendChild( options.word );

        // Resets the transform when changing to a new currentTime before the end event occurred.
        options.word.style[ supports.transform ] = "";

        options.word.style.fontSize = ~~( 30 + 20 * Math.random() ) + "px";
        spanLocation = spanLocation % ( options._container.offsetWidth - options.word.offsetWidth );
        options.word.style.left = spanLocation + "px";
        spanLocation += options.word.offsetWidth + 10;
        options.word.style[ supports.transform ] = "translateY(" +
          ( options._container.offsetHeight - options.word.offsetHeight ) + "px)";

        options.word.style.opacity = 1;

        // automatically clears the word based on time
        setTimeout( function() {

		      options.word.style.opacity = 0;
        // ensures at least one second exists, because the fade animation is 1 second
		    }, ( ( (options.end - options.start) - 1 ) || 1 ) * 1000 );
      },
      end: function( event, options ){

        // manually clears the word based on user interaction
        options.word.style.opacity = 0;
      },
      _teardown: function( options ) {

        var target = document.getElementById( options.target );
        // removes word span from generated container
        options.word.parentNode && options._container.removeChild( options.word );

        // if no more word spans exist in container, remove container
        container[ options.target ] &&
          !container[ options.target ].childElementCount &&
          target && target.removeChild( container[ options.target ] ) &&
          delete container[ options.target ];
      }
  });

})( Popcorn );
// PLUGIN: Mustache

(function ( Popcorn ) {

  /**
   * Mustache Popcorn Plug-in
   *
   * Adds the ability to render JSON using templates via the Mustache templating library.
   *
   * @param {Object} options
   *
   * Required parameters: start, end, template, data, and target.
   * Optional parameter: static.
   *
   *   start: the time in seconds when the mustache template should be rendered
   *          in the target div.
   *
   *   end: the time in seconds when the rendered mustache template should be
   *        removed from the target div.
   *
   *   target: a String -- the target div's id.
   *
   *   template: the mustache template for the plugin to use when rendering.  This can be
   *             a String containing the template, or a Function that returns the template's
   *             String.
   *
   *   data: the data to be rendered using the mustache template.  This can be a JSON String,
   *         a JavaScript Object literal, or a Function returning a String or Literal.
   *
   *   dynamic: an optional argument indicating that the template and json data are dynamic
   *            and need to be loaded dynamically on every use.  Defaults to True.
   *
   * Example:
     var p = Popcorn('#video')

        // Example using template and JSON strings.
        .mustache({
          start: 5, // seconds
          end:  15,  // seconds
          target: 'mustache',
          template: '<h1>{{header}}</h1>'                         +
                    '{{#bug}}'                                    +
                    '{{/bug}}'                                    +
                    ''                                            +
                    '{{#items}}'                                  +
                    '  {{#first}}'                                +
                    '    <li><strong>{{name}}</strong></li>'      +
                    '  {{/first}}'                                +
                    '  {{#link}}'                                 +
                    '    <li><a href="{{url}}">{{name}}</a></li>' +
                    '  {{/link}}'                                 +
                    '{{/items}}'                                  +
                    ''                                            +
                    '{{#empty}}'                                  +
                    '  <p>The list is empty.</p>'                 +
                    '{{/empty}}'                                  ,

          data:     '{'                                                        +
                    '  "header": "Colors", '                                   +
                    '  "items": [ '                                            +
                    '      {"name": "red", "first": true, "url": "#Red"}, '    +
                    '      {"name": "green", "link": true, "url": "#Green"}, ' +
                    '      {"name": "blue", "link": true, "url": "#Blue"} '    +
                    '  ],'                                                     +
                    '  'empty': false'                                         +
                    '}',
          dynamic: false // The json is not going to change, load it early.
        } )

        // Example showing Functions instead of Strings.
        .mustache({
          start: 20,  // seconds
          end:   25,  // seconds
          target: 'mustache',
          template: function(instance, options) {
                      var template = // load your template file here...
                      return template;
                    },
          data:     function(instance, options) {
                      var json = // load your json here...
                      return json;
                    }
        } );
  *
  */

  Popcorn.plugin( "mustache" , function( options ){

    var getData, data, getTemplate, template;

    Popcorn.getScript( "http://mustache.github.com/extras/mustache.js" );

    var shouldReload = !!options.dynamic,
        typeOfTemplate = typeof options.template,
        typeOfData = typeof options.data,
        target = document.getElementById( options.target );

    options.container = target || document.createElement( "div" );

    if ( typeOfTemplate === "function" ) {
      if ( !shouldReload ) {
        template = options.template( options );
      } else {
        getTemplate = options.template;
      }
    } else if ( typeOfTemplate === "string" ) {
      template = options.template;
    } else {
      template = "";
    }

    if ( typeOfData === "function" ) {
      if ( !shouldReload ) {
        data = options.data( options );
      } else {
        getData = options.data;
      }
    } else if ( typeOfData === "string" ) {
      data = JSON.parse( options.data );
    } else if ( typeOfData === "object" ) {
      data = options.data;
    } else {
      data = "";
    }

    return {
      start: function( event, options ) {

        var interval = function() {

          if( !window.Mustache ) {
            setTimeout( function() {
              interval();
            }, 10 );
          } else {

            // if dynamic, freshen json data on every call to start, just in case.
            if ( getData ) {
              data = getData( options );
            }

            if ( getTemplate ) {
              template = getTemplate( options );
            }

            var html = Mustache.to_html( template,
                                         data
                                       ).replace( /^\s*/mg, "" );
            options.container.innerHTML = html;
          }
        };

        interval();

      },

      end: function( event, options ) {
        options.container.innerHTML = "";
      },
      _teardown: function( options ) {
        getData = data = getTemplate = template = null;
      }
    };
  },
  {
    about: {
      name: "Popcorn Mustache Plugin",
      version: "0.1",
      author: "David Humphrey (@humphd)",
      website: "http://vocamus.net/dave"
    },
    options: {
      start: {
        elem: "input",
        type: "number",
        label: "Start"
      },
      end: {
        elem: "input",
        type: "number",
        label: "End"
      },
      target: "mustache-container",
      template: {
        elem: "input",
        type: "text",
        label: "Template"
      },
      data: {
        elem: "input",
        type: "text",
        label: "Data"
      },
      dynamic: {
        elem: "input",
        type: "checkbox",
        label: "Dynamic",
        "default": true
      }
    }
  });
})( Popcorn );
// PLUGIN: IMAGE

(function ( Popcorn ) {

/**
 * Images popcorn plug-in
 * Shows an image element
 * Options parameter will need a start, end, href, target and src.
 * Start is the time that you want this plug-in to execute
 * End is the time that you want this plug-in to stop executing
 * href is the url of the destination of a anchor - optional
 * Target is the id of the document element that the iframe needs to be attached to,
 * this target element must exist on the DOM
 * Src is the url of the image that you want to display
 * text is the overlayed text on the image - optional
 *
 * @param {Object} options
 *
 * Example:
   var p = Popcorn('#video')
      .image({
        start: 5, // seconds
        end: 15, // seconds
        href: 'http://www.drumbeat.org/',
        src: 'http://www.drumbeat.org/sites/default/files/domain-2/drumbeat_logo.png',
        text: 'DRUMBEAT',
        target: 'imagediv'
      } )
 *
 */

  var VIDEO_OVERLAY_Z = 2000,
      CHECK_INTERVAL_DURATION = 10;

  function trackMediaElement( mediaElement ) {
    var checkInterval = -1,
        container = document.createElement( "div" ),
        videoZ = getComputedStyle( mediaElement ).zIndex;

    container.setAttribute( "data-popcorn-helper-container", true );

    container.style.position = "absolute";

    if ( !isNaN( videoZ ) ) {
      container.style.zIndex = videoZ + 1;
    }
    else {
      container.style.zIndex = VIDEO_OVERLAY_Z;
    }

    document.body.appendChild( container );

    function check() {
      var mediaRect = mediaElement.getBoundingClientRect(),
          containerRect = container.getBoundingClientRect();

      if ( containerRect.left !== mediaRect.left ) {
        container.style.left = mediaRect.left + "px";
      }
      if ( containerRect.top !== mediaRect.top ) {
        container.style.top = mediaRect.top + "px";
      }
    }

    return {
      element: container,
      start: function() {
        checkInterval = setInterval( check, CHECK_INTERVAL_DURATION );
      },
      stop: function() {
        clearInterval( checkInterval );
        checkInterval = -1;
      },
      destroy: function() {
        document.body.removeChild( container );
        if ( checkInterval !== -1 ) {
          clearInterval( checkInterval );
        }
      }
    };
  }

  Popcorn.plugin( "image", {
      manifest: {
        about: {
          name: "Popcorn image Plugin",
          version: "0.1",
          author: "Scott Downe",
          website: "http://scottdowne.wordpress.com/"
        },
        options: {
          start: {
            elem: "input",
            type: "number",
            label: "Start"
          },
          end: {
            elem: "input",
            type: "number",
            label: "End"
          },
          src: {
            elem: "input",
            type: "url",
            label: "Image URL",
            "default": "http://mozillapopcorn.org/wp-content/themes/popcorn/images/for_developers.png"
          },
          href: {
            elem: "input",
            type: "url",
            label: "Link",
            "default": "http://mozillapopcorn.org/wp-content/themes/popcorn/images/for_developers.png",
            optional: true
          },
          target: "image-container",
          text: {
            elem: "input",
            type: "text",
            label: "Caption",
            "default": "Popcorn.js",
            optional: true
          }
        }
      },
      _setup: function( options ) {
        var img = document.createElement( "img" ),
            target = document.getElementById( options.target );

        options.anchor = document.createElement( "a" );
        options.anchor.style.position = "relative";
        options.anchor.style.textDecoration = "none";
        options.anchor.style.display = "none";

        // add the widget's div to the target div.
        // if target is <video> or <audio>, create a container and routinely
        // update its size/position to be that of the media
        if ( target ) {
          if ( [ "VIDEO", "AUDIO" ].indexOf( target.nodeName ) > -1 ) {
            options.trackedContainer = trackMediaElement( target );
            options.trackedContainer.element.appendChild( options.anchor );
          } else {
            target.appendChild( options.anchor );
          }
        }

        img.addEventListener( "load", function() {

          // borders look really bad, if someone wants it they can put it on their div target
          img.style.borderStyle = "none";

          options.anchor.href = options.href || options.src || "#";
          options.anchor.target = "_blank";

          var fontHeight, divText;

          img.style.height = target.style.height;
          img.style.width = target.style.width;

          options.anchor.appendChild( img );

          // If display text was provided, display it:
          if ( options.text ) {
            fontHeight = ( img.height / 12 ) + "px";
            divText = document.createElement( "div" );

            Popcorn.extend( divText.style, {
              color: "black",
              fontSize: fontHeight,
              fontWeight: "bold",
              position: "relative",
              textAlign: "center",
              width: img.style.width || img.width + "px",
              zIndex: "10"
            });

            divText.innerHTML = options.text || "";

            divText.style.top = ( ( img.style.height.replace( "px", "" ) || img.height ) / 2 ) - ( divText.offsetHeight / 2 ) + "px";
            options.anchor.insertBefore( divText, img );
          }
        }, false );

        img.src = options.src;

        options.toString = function() {
          var string = options.src || options._natives.manifest.options.src[ "default" ],
              match = string.replace( /.*\//g, "" );
          return match.length ? match : string;
        };
      },

      /**
       * @member image
       * The start function will be executed when the currentTime
       * of the video  reaches the start time provided by the
       * options variable
       */
      start: function( event, options ) {
        options.anchor.style.display = "inline";
        if ( options.trackedContainer ) {
          options.trackedContainer.start();
        }
      },
      /**
       * @member image
       * The end function will be executed when the currentTime
       * of the video  reaches the end time provided by the
       * options variable
       */
      end: function( event, options ) {
        options.anchor.style.display = "none";
        if ( options.trackedContainer ) {
          options.trackedContainer.stop();
        }
      },
      _teardown: function( options ) {
        if ( options.trackedContainer ) {
          options.trackedContainer.destroy();
        }
        else if ( options.anchor.parentNode ) {
          options.anchor.parentNode.removeChild( options.anchor );
        }
      }
  });
})( Popcorn );
// PLUGIN: LEAFLET
( function ( Popcorn ) {

  /**
   * leaflet popcorn plug-in
   * Adds a leaflet map and open map tiles (OpenStreetMap [default], Mapbox Satellite/Terrain,
   * or Stamen (toner/wateroclor/terrain))
   * 
   * Based on the openmap popcorn plug-in. No StreetView support
   *
   * Options parameter will need a start, end, target, type, zoom, lat and lng, and apikKy
   * -Start is the time that you want this plug-in to execute
   * -End is the time that you want this plug-in to stop executing
   * -Target is the id of the DOM element that you want the map to appear in. This element must be in the DOM
   * -Type [optional] either: ROADMAP (OpenStreetMap), SATELLITE (Mapbox Satellite),  TERRAIN (Mapbox Outdoors), or COMIC (Mapbox Comic).
   *                          The Stamen custom map types can also be used (http://maps.stamen.com): STAMEN-TONER,
   *                          STAMEN-TERRAIN, or STAMEN-WATERCOLOR.
   * -Zoom [optional] defaults to 2
   * -Lat and Lng are the coordinates of the map if location is not named
   * -Location is a name of a place to center the map, geocoded to coordinates using Mapbox geocoding API
   * -Markers [optional] is an array of map marker objects, with the following properties:
   * --Icon is the URL of a map marker image
   * --Size [optional] is the radius in pixels of the scaled marker image (default is 14)
   * --Text [optional] is the HTML content of the map marker -- if your popcorn instance is named 'popped', use <script>popped.currentTime(10);</script> to control the video
   * --Lat and Lng are coordinates of the map marker if location is not specified
   * --Location is a name of a place for the map marker, geocoded to coordinates using mapbox
   *  Note: using location requires extra loading time; also failure to  specify one of lat/lng or location will
   * cause a JavaScript error.
   * - apiKey is your Mpabox API Key. This is required, and recommended to be set using
   *   Popcorn's `defaults` property
   * - fly is an object that moves the map from the initial location to a desired endpoint
   * -- endpoint is either a lat/long array or a string to be geocoded
   * -- wait is the length of time to wait after the start evnet fires
   * -- flightLength is the length of time ti take moving the map
   * @param {Object} options
   *
   * Example:
     var p = Popcorn( '#video' )
        .leaflet({
          start: 5,
          end: 15,
          type: 'ROADMAP',
          target: 'map',
          lat: 43.665429,
          lng: -79.403323
        })
   *
   */

  //console.log(options);
  var newdiv, persistentmap , persistentFlyEndpoint,
      i = 1;

  function toggle( container, display ) {
    if ( container.map ) {
      container.map.div.style.display = display;
      return;
    }

    setTimeout(function() {
      toggle( container, display );
    }, 10 );
  }

  function flyMap (map, flyOptions) {
    // console.log(flyOptions);
    setTimeout ( function () {
     map.panTo(flyOptions.endpoint, {animate: true, duration: flyOptions.flightLength});
    }, flyOptions.wait * 1000);
  }
  
  Popcorn.plugin( "leaflet", function( options ){
    var newdiv,
        centerlonlat,
        projection,
        displayProjection,
        pointLayer,
        selectControl,
        popup,
        isGeoReady,
        target = document.getElementById( options.target );

    // create a new div within the target div
    // this is later passed on to the maps api
    newdiv = document.createElement( "div" );
    newdiv.style.display = "none";
    newdiv.id = "leafletdiv" + i;
    newdiv.classList.add("leaflet-plugin");
    newdiv.style.width = "100%";
    newdiv.style.height = "100%";
    i++;

    if (target)
    {target.appendChild( newdiv );}
    
    var center;


    return {
      /**
       * @member leaflet
       * The setup function will be executed when the plug-in is instantiated
       */
      _setup: async function( options ) {
        // grab the leafvar css, we need it!
        var head = document.querySelector('head');
        var link = document.createElement('link');
        link.rel = 'stylesheet';  
        link.type = 'text/css'; 
        link.href = "https://unpkg.com/leaflet@1.5.1/dist/leaflet.css";
        // insert leaflet api script once
        if ( !window.L ) {
          head.appendChild(link);
          Popcorn.getScript( "https://unpkg.com/leaflet@1.5.1/dist/leaflet.js" , function() {
              console.log('empty callback');
            // insert jquery -- not sure why I need this though!
            //  Popcorn.getScript( "https://code.jquery.com/jquery-3.4.1.min.js" );
          } );
        }

        gc = async function( location ) {
          let point;
          let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${location}.json?limit=1&access_token=${options.apiKey}`;
          return await fetch (url)
            .then ( (response) => response.json() )
            .then ( (json) => {let c = json.features[0].center;  return L.latLng([ c[1], c[0] ]); } );
        };

        // callback function fires when the script is run
        isGeoReady = async function() {
          if ( ! ( window.L  ) ) {
            setTimeout(function() {
              isGeoReady();
            }, 50);
          } else {
            if ( options.location ) {
              center =  await gc(options.location);
            } else {
              options.lat = options.lat || 51;
              options.lng = options.lng || -1.5;
              center = L.latLng( options.lat, options.lng );
            }
            // console.log ('center is ' + center + options.location || '');

            persistentmap = options.map = L.map(newdiv).setView(center, options.zoom || 12);

            // persistentmap ? console.log('pmap exists') : console.log ('pmap does NOT exist');
            options.type = options.type || "ROADMAP";// XXX: 
            switch( options.type ) {
            case "SATELLITE" :
              L.tileLayer(`https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoidGl0YW5pdW1ib25lcyIsImEiOiJjazF0bTdlNXQwM3gxM2hwbXY0bWtiamM3In0.FFPm7UIuj_b15xnd7wOQig`, {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              })
                .addTo(options.map);
              // console.log(options.map);
              break;
            case "TERRAIN":
              // add terrain map ( USGS )
              L.tileLayer(`https://api.mapbox.com/v4/mapbox.outdoors/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoidGl0YW5pdW1ib25lcyIsImEiOiJjazF0bTdlNXQwM3gxM2hwbXY0bWtiamM3In0.FFPm7UIuj_b15xnd7wOQig`, {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              })
                .addTo(options.map);
              break;
            case "STAMEN-TONER":
             L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}{r}.{ext}', {
	        attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	        subdomains: 'abcd',
	        minZoom: 0,
	        maxZoom: 20,
	        ext: 'png'
              })
                .addTo(options.map);
                break;
            case "STAMEN-WATERCOLOR":
              L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}{r}.{ext}', {
	        attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	        subdomains: 'abcd',
	        minZoom: 0,
	        maxZoom: 20,
	        ext: 'png'
              })
              // L.tileLayer(`https://api.mapbox.com/v4/mapbox.comic/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoidGl0YW5pdW1ib25lcyIsImEiOiJjazF0bTdlNXQwM3gxM2hwbXY0bWtiamM3In0.FFPm7UIuj_b15xnd7wOQig`, {
              //   attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              // })
                .addTo(options.map);
              break;
            case "STAMEN-TERRAIN":
              console.log("st terrain")
              L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.{ext}', {
	        attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	        subdomains: 'abcd',
	        minZoom: 0,
	        maxZoom: 20,
	        ext: 'png'
              })
                .addTo(options.map);
              break;
            case "COMIC":
              L.tileLayer(`https://api.mapbox.com/v4/mapbox.comic/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoidGl0YW5pdW1ib25lcyIsImEiOiJjazF0bTdlNXQwM3gxM2hwbXY0bWtiamM3In0.FFPm7UIuj_b15xnd7wOQig`, {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              })
                .addTo(options.map);
  
            default: /* case "ROADMAP": */
                // add OpenStreetMap layer
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              }).addTo(options.map);
                break;
            }
            if (options.fly && options.fly.endpoint ) {
              switch (typeof (options.fly.endpoint)) {
              case "string":
                persistentFlyEndpoint = await gc(options.fly.endpoint);
                break;
              case "array":
                persistentFlyEndpoint = options.fly.endpoint;
                break;
              }
            }

            
            if ( options.map ) {
              options.map.div = newdiv;
            }
          }
        };

        await isGeoReady();

        var isReady = async function() {
          // wait until OpenLayers has been loaded, and the start function is run, before adding map
          if ( !options.map ) {
            setTimeout(function() {
              isReady();
            }, 13 );
          } else {

            // default zoom is 2
            options.zoom = options.zoom || 2;

            // make sure options.zoom is a number
            if ( options.zoom && typeof options.zoom !== "number" ) {
              options.zoom = +options.zoom;
            }

            // reset the location and zoom just in case the user played with the map
            options.map.setView( center, options.zoom );
            if ( options.markers )  {

              for (var m of options.markers) {
                var o;
                if (m.location) {
                  o = L.marker(await gc(m.location)).addTo(options.map);
                  if (m.text) o.bindPopup(m.text);
                } else if (m.lat && m.lng) {
                  o = L.marker([m.lat, m.lng]).addTo(options.map);
                  if (m.text) o.bindPopup(m.text);
                } else {console.log ("marker is missing lat/lng and location, unable to add")}
              }
              
            }
          }
          //persistentmap ? console.log('pmap exists') : console.log ('pmap does NOT exist');

        };

        await isReady();
      },

      /**
       * @member leaflet
       * The start function will be executed when the currentTime
       * of the video  reaches the start time provided by the
       * options variable
       */
      start: function( event, options ) {
        //persistentmap ? console.log('pmap exists') : console.log ('pmap does NOT exist');

        toggle( options, "block" );
        if (options.fly) {
          //console.log (persistentmap)
          if (persistentFlyEndpoint) {options.fly.endpoint = persistentFlyEndpoint}
          flyMap (persistentmap, options.fly);
        }
      },
        /**
         * @member leaflet
         * The end function will be executed when the currentTime
         * of the video reaches the end time provided by the
         * options variable
         */
        end: function( event, options ) {
          toggle( options, "none" );
      },

      _teardown: function( options ) {

        target && target.removeChild( newdiv );
        newdiv = map = centerlonlat = projection = displayProjection = pointLayer = selectControl = popup = null;
      }
    };
  },
  {
    about:{
      name: "Popcorn Leaflet Plugin",
      version: "0.1",
      author: "@mapmeld, @titaniumbones",
      website: "https://digitalhistory.github.io"
    },
    options:{
      start: {
        elem: "input",
        type: "number",
        label: "Start"
      },
      end: {
        elem: "input",
        type: "number",
        label: "End"
      },
      target: "map-container",
      type: {
        elem: "select",
        options: [ "ROADMAP", "SATELLITE", "TERRAIN" ],
        label: "Map Type",
        optional: true
      },
      zoom: {
        elem: "input",
        type: "number",
        label: "Zoom",
        "default": 2
      },
      lat: {
        elem: "input",
        type: "text",
        label: "Lat",
        optional: true
      },
      lng: {
        elem: "input",
        type: "text",
        label: "Lng",
        optional: true
      },
      location: {
        elem: "input",
        type: "text",
        label: "Location",
        "default": "Toronto, Ontario, Canada"
      },
      markers: {
        elem: "input",
        type: "text",
        label: "List Markers",
        optional: true
      },
      apiKey: {
        elem: "input",
        type: "text",
        label: "ApiKey",
        optional: false
      }
    }
  });
}) ( Popcorn );

// PLUGIN: Google Maps
var googleCallback;
(function ( Popcorn ) {

  var i = 1,
    _mapFired = false,
    _mapLoaded = false,
    geocoder, loadMaps;
  //google api callback
  googleCallback = function ( data ) {
    // ensure all of the maps functions needed are loaded
    // before setting _maploaded to true
    if ( typeof google !== "undefined" && google.maps && google.maps.Geocoder && google.maps.LatLng ) {
      geocoder = new google.maps.Geocoder();
      Popcorn.getScript( "https://maps.stamen.com/js/tile.stamen.js", function() {
        _mapLoaded = true;
      });
    } else {
      setTimeout(function () {
        googleCallback( data );
      }, 1);
    }
  };
  // function that loads the google api
  loadMaps = function (apiKey) {
    // for some reason the Google Map API adds content to the body
    if ( document.body ) {
      _mapFired = true;
      Popcorn.getScript( "https://maps.googleapis.com/maps/api/js?key="+apiKey+"&callback=googleCallback&libraries=geometry");
    } else {
      setTimeout(function () {
        loadMaps();
      }, 1);
    }
  };

  function buildMap( options, location, mapDiv ) {
    var type = options.type ? options.type.toUpperCase() : "HYBRID",
      layer;

    // See if we need to make a custom Stamen map layer
    if ( type === "STAMEN-WATERCOLOR" ||
         type === "STAMEN-TERRAIN"    ||
         type === "STAMEN-TONER" ) {
      // Stamen types are lowercase
      layer = type.replace("STAMEN-", "").toLowerCase();
    }

    var map = new google.maps.Map( mapDiv, {
      // If a custom layer was specified, use that, otherwise use type
      mapTypeId: layer ? layer : google.maps.MapTypeId[ type ],
      // Hide the layer selection UI
      mapTypeControlOptions: { mapTypeIds: [] }
    });

    if ( layer ) {
      map.mapTypes.set( layer, new google.maps.StamenMapType( layer ));
    }
    map.getDiv().style.display = "none";

    return map;
  }

  /**
   * googlemap popcorn plug-in
   * Adds a map to the target div centered on the location specified by the user
   * Options parameter will need a start, end, target, type, zoom, lat and lng, and location
   * -Start is the time that you want this plug-in to execute
   * -End is the time that you want this plug-in to stop executing
   * -Target is the id of the DOM element that you want the map to appear in. This element must be in the DOM
   * -Type [optional] either: HYBRID (default), ROADMAP, SATELLITE, TERRAIN, STREETVIEW, or one of the
   *                          Stamen custom map types (http://http://maps.stamen.com): STAMEN-TONER,
   *                          STAMEN-WATERCOLOR, or STAMEN-TERRAIN.
   * -Zoom [optional] defaults to 0
   * -Heading [optional] STREETVIEW orientation of camera in degrees relative to true north (0 north, 90 true east, ect)
   * -Pitch [optional] STREETVIEW vertical orientation of the camera (between 1 and 3 is recommended)
   * -Lat and Lng: the coordinates of the map must be present if location is not specified.
   * -Height [optional] the height of the map, in "px" or "%". Defaults to "100%".
   * -Width [optional] the width of the map, in "px" or "%". Defaults to "100%".
   * -Location: the adress you want the map to display, must be present if lat and lng are not specified.
   * Note: using location requires extra loading time, also not specifying both lat/lng and location will
   * cause and error.
   * -apiKey is your Google Maps API key
   *
   * Tweening works using the following specifications:
   * -location is the start point when using an auto generated route
   * -tween when used in this context is a string which specifies the end location for your route
   * Note that both location and tween must be present when using an auto generated route, or the map will not tween
   * -interval is the speed in which the tween will be executed, a reasonable time is 1000 ( time in milliseconds )
   * Heading, Zoom, and Pitch streetview values are also used in tweening with the autogenerated route
   *
   * -tween is an array of objects, each containing data for one frame of a tween
   * -position is an object with has two paramaters, lat and lng, both which are mandatory for a tween to work
   * -pov is an object which houses heading, pitch, and zoom paramters, which are all optional, if undefined, these values default to 0
   * -interval is the speed in which the tween will be executed, a reasonable time is 1000 ( time in milliseconds )
   *
   * @param {Object} options
   *
   * Example:
   var p = Popcorn("#video")
   .googlemap({
   start: 5, // seconds
   end: 15, // seconds
   type: "ROADMAP",
   target: "map",
   lat: 43.665429,
   lng: -79.403323,
   apiKey: "AO3ousdflj4_slkjwmsdmmr"
   } )
   *
   */
  Popcorn.plugin( "googlemap", function ( options ) {
    var newdiv, map, location,
        target = document.getElementById( options.target );

    options.type = options.type || "ROADMAP";
    options.zoom = options.zoom || 1;
    options.lat = options.lat || 0;
    options.lng = options.lng || 0;

    // if this is the firest time running the plugins
    // call the function that gets the sctipt
    if ( !_mapFired ) {
      loadMaps(options.apiKey);
    }

    // create a new div this way anything in the target div is left intact
    // this is later passed on to the maps api
    newdiv = document.createElement( "div" );
    newdiv.id = "actualmap" + i;
    newdiv.style.width = options.width || "100%";

    // height is a little more complicated than width.
    if ( options.height ) {
      newdiv.style.height = options.height;
    } else if ( target && target.clientHeight ) {
      newdiv.style.height = target.clientHeight + "px";
    } else {
      newdiv.style.height = "100%";
    }

    i++;

    target && target.appendChild( newdiv );

    // ensure that google maps and its functions are loaded
    // before setting up the map parameters
    var isMapReady = function () {
      if ( _mapLoaded ) {
        if ( newdiv ) {
          if ( options.location ) {
            // calls an anonymous google function called on separate thread
            geocoder.geocode({
              "address": options.location
            }, function ( results, status ) {
              // second check for newdiv since it could have disappeared before
              // this callback is actual run
              if ( newdiv && status === google.maps.GeocoderStatus.OK ) {
                options.lat = results[ 0 ].geometry.location.lat();
                options.lng = results[ 0 ].geometry.location.lng();
                location = new google.maps.LatLng( options.lat, options.lng );
                map = buildMap( options, location, newdiv );
              }
            });
          } else {
            location = new google.maps.LatLng( options.lat, options.lng );
            map = buildMap( options, location, newdiv );
          }
        }
      } else {
          setTimeout(function () {
            isMapReady();
          }, 5);
        }
      };

    isMapReady();

    options.toString = function() {
      return options.location || ( ( options.lat && options.lng ) ? options.lat + ", " + options.lng : options._natives.manifest.options.location[ "default" ] );
    };

    return {
      /**
       * @member webpage
       * The start function will be executed when the currentTime
       * of the video reaches the start time provided by the
       * options variable
       */
      start: function( event, options ) {
        var that = this,
            sView;

        // ensure the map has been initialized in the setup function above
        var isMapSetup = function() {
          if ( map ) {
            options._map = map;

            map.getDiv().style.display = "block";
            // reset the location and zoom just in case the user plaid with the map
            google.maps.event.trigger( map, "resize" );
            map.setCenter( location );

            // make sure options.zoom is a number
            if ( options.zoom && typeof options.zoom !== "number" ) {
              options.zoom = +options.zoom;
            }

            map.setZoom( options.zoom );

            //Make sure heading is a number
            if ( options.heading && typeof options.heading !== "number" ) {
              options.heading = +options.heading;
            }
            //Make sure pitch is a number
            if ( options.pitch && typeof options.pitch !== "number" ) {
              options.pitch = +options.pitch;
            }

            if ( options.type === "STREETVIEW" ) {
              // Switch this map into streeview mode
              map.setStreetView(
              // Pass a new StreetViewPanorama instance into our map

                sView = new google.maps.StreetViewPanorama( newdiv, {
                  position: location,
                  pov: {
                    heading: options.heading = options.heading || 0,
                    pitch: options.pitch = options.pitch || 0,
                    zoom: options.zoom
                  }
                })
              );

              //  Function to handle tweening using a set timeout
              var tween = function( rM, t ) {

                var computeHeading = google.maps.geometry.spherical.computeHeading;
                setTimeout(function() {

                  var current_time = that.media.currentTime;

                  //  Checks whether this is a generated route or not
                  if ( typeof options.tween === "object" ) {

                    for ( var i = 0, m = rM.length; i < m; i++ ) {

                      var waypoint = rM[ i ];

                      //  Checks if this position along the tween should be displayed or not
                      if ( current_time >= ( waypoint.interval * ( i + 1 ) ) / 1000 &&
                         ( current_time <= ( waypoint.interval * ( i + 2 ) ) / 1000 ||
                           current_time >= waypoint.interval * ( m ) / 1000 ) ) {

                        sView3.setPosition( new google.maps.LatLng( waypoint.position.lat, waypoint.position.lng ) );

                        sView3.setPov({
                          heading: waypoint.pov.heading || computeHeading( waypoint, rM[ i + 1 ] ) || 0,
                          zoom: waypoint.pov.zoom || 0,
                          pitch: waypoint.pov.pitch || 0
                        });
                      }
                    }

                    //  Calls the tween function again at the interval set by the user
                    tween( rM, rM[ 0 ].interval );
                  } else {

                    for ( var k = 0, l = rM.length; k < l; k++ ) {

                      var interval = options.interval;

                      if( current_time >= (interval * ( k + 1 ) ) / 1000 &&
                        ( current_time <= (interval * ( k + 2 ) ) / 1000 ||
                          current_time >= interval * ( l ) / 1000 ) ) {

                        sView2.setPov({
                          heading: computeHeading( rM[ k ], rM[ k + 1 ] ) || 0,
                          zoom: options.zoom,
                          pitch: options.pitch || 0
                        });
                        sView2.setPosition( checkpoints[ k ] );
                      }
                    }

                    tween( checkpoints, options.interval );
                  }
                }, t );
              };

              //  Determines if we should use hardcoded values ( using options.tween ),
              //  or if we should use a start and end location and let google generate
              //  the route for us
              if ( options.location && typeof options.tween === "string" ) {

              //  Creating another variable to hold the streetview map for tweening,
              //  Doing this because if there was more then one streetview map, the tweening would sometimes appear in other maps
              var sView2 = sView;

                //  Create an array to store all the lat/lang values along our route
                var checkpoints = [];

                //  Creates a new direction service, later used to create a route
                var directionsService = new google.maps.DirectionsService();

                //  Creates a new direction renderer using the current map
                //  This enables us to access all of the route data that is returned to us
                var directionsDisplay = new google.maps.DirectionsRenderer( sView2 );

                var request = {
                  origin: options.location,
                  destination: options.tween,
                  travelMode: google.maps.TravelMode.DRIVING
                };

                //  Create the route using the direction service and renderer
                directionsService.route( request, function( response, status ) {

                  if ( status == google.maps.DirectionsStatus.OK ) {
                    directionsDisplay.setDirections( response );
                    showSteps( response, that );
                  }

                });

                var showSteps = function ( directionResult, that ) {

                  //  Push new google map lat and lng values into an array from our list of lat and lng values
                  var routes = directionResult.routes[ 0 ].overview_path;
                  for ( var j = 0, k = routes.length; j < k; j++ ) {
                    checkpoints.push( new google.maps.LatLng( routes[ j ].lat(), routes[ j ].lng() ) );
                  }

                  //  Check to make sure the interval exists, if not, set to a default of 1000
                  options.interval = options.interval || 1000;
                  tween( checkpoints, 10 );

                };
              } else if ( typeof options.tween === "object" ) {

                //  Same as the above to stop streetview maps from overflowing into one another
                var sView3 = sView;

                for ( var i = 0, l = options.tween.length; i < l; i++ ) {

                  //  Make sure interval exists, if not, set to 1000
                  options.tween[ i ].interval = options.tween[ i ].interval || 1000;
                  tween( options.tween, 10 );
                }
              }
            }

            if ( options.onmaploaded ) {
              options.onmaploaded( options, map );
            }

          } else {
            setTimeout(function () {
              isMapSetup();
            }, 13);
          }

        };
        isMapSetup();
      },
      /**
       * @member webpage
       * The end function will be executed when the currentTime
       * of the video reaches the end time provided by the
       * options variable
       */
      end: function ( event, options ) {
        // if the map exists hide it do not delete the map just in
        // case the user seeks back to time b/w start and end
        if ( map ) {
          map.getDiv().style.display = "none";
        }
      },
      _teardown: function ( options ) {

        var target = document.getElementById( options.target );

        // the map must be manually removed
        target && target.removeChild( newdiv );
        newdiv = map = location = null;

        options._map = null;
      }
    };
  }, {
    about: {
      name: "Popcorn Google Map Plugin",
      version: "0.2",
      author: "@annasob",
      website: "annasob.wordpress.com"
    },
    options: {
      start: {
        elem: "input",
        type: "start",
        label: "Start"
      },
      end: {
        elem: "input",
        type: "start",
        label: "End"
      },
      target: "map-container",
      type: {
        elem: "select",
        options: [ "ROADMAP", "SATELLITE", "STREETVIEW", "HYBRID", "TERRAIN", "STAMEN-WATERCOLOR", "STAMEN-TERRAIN", "STAMEN-TONER" ],
        label: "Map Type",
        optional: true
      },
      zoom: {
        elem: "input",
        type: "text",
        label: "Zoom",
        "default": 0,
        optional: true
      },
      lat: {
        elem: "input",
        type: "text",
        label: "Lat",
        optional: true
      },
      lng: {
        elem: "input",
        type: "text",
        label: "Lng",
        optional: true
      },
      location: {
        elem: "input",
        type: "text",
        label: "Location",
        "default": "Toronto, Ontario, Canada"
      },
      heading: {
        elem: "input",
        type: "text",
        label: "Heading",
        "default": 0,
        optional: true
      },
      pitch: {
        elem: "input",
        type: "text",
        label: "Pitch",
        "default": 1,
        optional: true
      },
      apiKey: {
        elem: "input",
        type: "text",
        label: "ApiKey",
        optional: false
      }
    }
  });
})( Popcorn );

// PLUGIN: Subtitle

(function ( Popcorn ) {

  var i = 0,
      createDefaultContainer = function( context, id ) {

        var ctxContainer = context.container = document.createElement( "div" ),
            style = ctxContainer.style,
            media = context.media;

        var updatePosition = function() {
          var position = context.position();
          // the video element must have height and width defined
          style.fontSize = "18px";
          style.width = media.offsetWidth + "px";
          style.top = position.top  + media.offsetHeight - ctxContainer.offsetHeight - 40 + "px";
          style.left = position.left + "px";

          setTimeout( updatePosition, 10 );
        };

        ctxContainer.id = id || Popcorn.guid();
        style.position = "absolute";
        style.color = "white";
        style.textShadow = "black 2px 2px 6px";
        style.fontWeight = "bold";
        style.textAlign = "center";

        updatePosition();

        context.media.parentNode.appendChild( ctxContainer );

        return ctxContainer;
      };

  /**
   * Subtitle popcorn plug-in
   * Displays a subtitle over the video, or in the target div
   * Options parameter will need a start, and end.
   * Optional parameters are target and text.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing
   * Target is the id of the document element that the content is
   *  appended to, this target element must exist on the DOM
   * Text is the text of the subtitle you want to display.
   *
   * @param {Object} options
   *
   * Example:
     var p = Popcorn('#video')
        .subtitle({
          start:            5,                 // seconds, mandatory
          end:              15,                // seconds, mandatory
          text:             'Hellow world',    // optional
          target:           'subtitlediv',     // optional
        } )
   *
   */

  Popcorn.plugin( "subtitle" , {

      manifest: {
        about: {
          name: "Popcorn Subtitle Plugin",
          version: "0.1",
          author: "Scott Downe",
          website: "http://scottdowne.wordpress.com/"
        },
        options: {
          start: {
            elem: "input",
            type: "text",
            label: "Start"
          },
          end: {
            elem: "input",
            type: "text",
            label: "End"
          },
          target: "subtitle-container",
          text: {
            elem: "input",
            type: "text",
            label: "Text"
          }
        }
      },

      _setup: function( options ) {
        var newdiv = document.createElement( "div" );

        newdiv.id = "subtitle-" + i++;
        newdiv.style.display = "none";

        // Creates a div for all subtitles to use
        ( !this.container && ( !options.target || options.target === "subtitle-container" ) ) &&
          createDefaultContainer( this );

        // if a target is specified, use that
        if ( options.target && options.target !== "subtitle-container" ) {
          // In case the target doesn't exist in the DOM
          options.container = document.getElementById( options.target ) || createDefaultContainer( this, options.target );
        } else {
          // use shared default container
          options.container = this.container;
        }

        document.getElementById( options.container.id ) && document.getElementById( options.container.id ).appendChild( newdiv );
        options.innerContainer = newdiv;

        options.showSubtitle = function() {
          options.innerContainer.innerHTML = options.text || "";
        };
      },
      /**
       * @member subtitle
       * The start function will be executed when the currentTime
       * of the video  reaches the start time provided by the
       * options variable
       */
      start: function( event, options ){
        options.innerContainer.style.display = "inline";
        options.showSubtitle( options, options.text );
      },
      /**
       * @member subtitle
       * The end function will be executed when the currentTime
       * of the video  reaches the end time provided by the
       * options variable
       */
      end: function( event, options ) {
        options.innerContainer.style.display = "none";
        options.innerContainer.innerHTML = "";
      },

      _teardown: function ( options ) {
        options.container.removeChild( options.innerContainer );
      }

  });

})( Popcorn );
// PLUGIN: Text

(function ( Popcorn ) {

  /**
   * Text Popcorn plug-in
   *
   * Places text in an element on the page.  Plugin options include:
   * Options parameter will need a start, end.
   *   Start: Is the time that you want this plug-in to execute
   *   End: Is the time that you want this plug-in to stop executing
   *   Text: Is the text that you want to appear in the target
   *   ID: ID for div (defaults to `textdiv${i}`)
   *   Escape: {true|false} Whether to escape the text (e.g., html strings)
   *   Multiline: {true|false} Whether newlines should be turned into <br>s
   *   Target: Is the ID of the element where the text should be placed. An empty target
   *           will be placed on top of the media element
   *
   * @param {Object} options
   *
   * Example:
   *  var p = Popcorn('#video')
   *
   *    // Simple text
   *    .text({
   *      start: 5, // seconds
   *      end: 15, // seconds
   *      text: 'This video made exclusively for drumbeat.org',
   *      target: 'textdiv'
   *     })
   *
   *    // HTML text, rendered as HTML
   *    .text({
   *      start: 15, // seconds
   *      end: 20, // seconds
   *      text: '<p>This video made <em>exclusively</em> for drumbeat.org</p>',
   *      target: 'textdiv'
   *    })
   *
   *    // HTML text, escaped and rendered as plain text
   *    .text({
   *      start: 20, // seconds
   *      end: 25, // seconds
   *      text: 'This is an HTML p element: <p>paragraph</p>',
   *      escape: true,
   *      target: 'textdiv'
   *    })
   *
   *    // Multi-Line HTML text, escaped and rendered as plain text
   *    .text({
   *      start: 25, // seconds
   *      end: 30, // seconds
   *      text: 'This is an HTML p element: <p>paragraph</p>\nThis is an HTML b element: <b>bold</b>',
   *      escape: true,
   *      multiline: true,
   *      target: 'textdiv'
   *    });
   *
   *    // Subtitle text
   *    .text({
   *      start: 30, // seconds
   *      end: 40, // seconds
   *      text: 'This will be overlayed on the video',
   *     })
   **/

  /**
   * HTML escape code from mustache.js, used under MIT Licence
   * https://github.com/janl/mustache.js/blob/master/mustache.js
   **/
  const escapeMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;'
  };

  function escapeHTML( string, multiline ) {
    return String( string ).replace( /&(?!\w+;)|[<>"']/g, function ( s ) {
      return escapeMap[ s ] || s;
    });
  }

  function newlineToBreak( string ) {
    // Deal with both \r\n and \n
    return string.replace( /\r?\n/gm, "<br>" );
  }

  // Subtitle specific functionality
  function createSubtitleContainer( context, id ) {

    var ctxContainer = context.container = document.createElement( "div" ),
        style = ctxContainer.style,
        media = context.media;

    var updatePosition = function() {
      var position = context.position();
      // the video element must have height and width defined
      style.fontSize = "18px";
      style.width = media.offsetWidth + "px";
      style.top = position.top  + media.offsetHeight - ctxContainer.offsetHeight - 40 + "px";
      style.left = position.left + "px";

      setTimeout( updatePosition, 10 );
    };

    ctxContainer.id = id || "";
    style.position = "absolute";
    style.color = "white";
    style.textShadow = "black 2px 2px 6px";
    style.fontWeight = "bold";
    style.textAlign = "center";

    updatePosition();

    context.media.parentNode.appendChild( ctxContainer );

    return ctxContainer;
  }
  var i = 0;

  Popcorn.plugin( "text", function (options ) {
    
    return {
    _setup: function( options ) {

      var target,
          text,
          container = options._container = document.createElement( "div" );

      container.style.display = "none";
      container.id = options.id || `textdiv${i}`;
      container.classList.add("text-plugin");
      i++;
      console.log(container.classList)
      if ( options.target ) {
        // Try to use supplied target
        target = Popcorn.dom.find( options.target );

        if ( !target ) {
          target = createSubtitleContainer( this, options.target );
        }
        else if ( [ "VIDEO", "AUDIO" ].indexOf( target.nodeName ) > -1 ) {
          target = createSubtitleContainer( this, options.target + "-overlay" );
        }

      } else if ( !this.container ) {
        // Creates a div for all subtitles to use
        target = createSubtitleContainer( this );

      } else {
        // Use subtitle container
        target = this.container;
      }

      // cache reference to actual target container
      options._target = target;

      // Escape HTML text if requested
      text = !!options.escape ? escapeHTML( options.text ) :
                                    options.text;

      // Swap newline for <br> if requested
      text = !!options.multiline ? newlineToBreak ( text ) : text;
      container.innerHTML = text || "";

      target.appendChild( container );

      options.toString = function() {
        // use the default option if it doesn't exist
        return options.text || options._natives.manifest.options.text[ "default" ];
      };
    },

    /**
     * @member text
     * The start function will be executed when the currentTime
     * of the video  reaches the start time provided by the
     * options variable
     */
    start: function( event, options ) {
      options._container.style.display = "inline";
    },

    /**
     * @member text
     * The end function will be executed when the currentTime
     * of the video  reaches the end time provided by the
     * options variable
     */
    end: function( event, options ) {
      options._container.style.display = "none";
    },
    _teardown: function( options ) {
      var target = options._target;
      if ( target ) {
        target.removeChild( options._container );
      }
    }
    }
  }, {
      about: {
        name: "Popcorn Text Plugin",
        version: "0.1",
        author: "@humphd"
      },
      options: {
        start: {
          elem: "input",
          type: "number",
          label: "Start"
        },
        end: {
          elem: "input",
          type: "number",
          label: "End"
        },
        text: {
          elem: "input",
          type: "text",
          label: "Text",
          "default": "Popcorn.js"
        },
        escape: {
          elem: "input",
          type: "checkbox",
          label: "Escape"
        },
        multiline: {
          elem: "input",
          type: "checkbox",
          label: "Multiline"
        },
        id: {
          elem: "input",
          type: "text",
          label: "ID",
          optional: true
        }
      }
  });
})( Popcorn );
// PLUGIN: documentcloud

(function( Popcorn, document ) {

  /**
   * Document Cloud popcorn plug-in
   *
   * @param {Object} options
   *
   * Example:
   *  var p = Popcorn("#video")
   *     // Let the pdf plugin load your PDF file for you using pdfUrl.
   *     .documentcloud({
   *       start: 45
   *       url: "http://www.documentcloud.org/documents/70050-urbina-day-1-in-progress.html", // or .js
   *       width: ...,
   *       height: ...,
   *       zoom: ...,
   *       page: ...,
   *       container: ...
   *     });

api - https://github.com/documentcloud/document-viewer/blob/master/public/javascripts/DV/controllers/api.js

   */

   // track registered plugins by document
   var documentRegistry = {};

  Popcorn.plugin( "documentcloud", {

    manifest: {
      about: {
        name: "Popcorn Document Cloud Plugin",
        version: "0.1",
        author: "@humphd, @ChrisDeCairos",
        website: "http://vocamus.net/dave"
      },
      options: {
        start: {
          elem: "input",
          type: "number",
          label: "Start"
        },
        end: {
          elem: "input",
          type: "number",
          label: "End"
        },
        target: "documentcloud-container",
        width: {
          elem: "input",
          type: "text",
          label: "Width",
          optional: true
        },
        height: {
          elem: "input",
          type: "text",
          label: "Height",
          optional: true
        },
        src: {
          elem: "input",
          type: "url",
          label: "PDF URL",
          "default": "http://www.documentcloud.org/documents/70050-urbina-day-1-in-progress.html"
        },
        preload: {
          elem: "input",
          type: "checkbox",
          label: "Preload",
          "default": true
        },
        page: {
          elem: "input",
          type: "number",
          label: "Page Number",
          optional: true
        },
        aid: {
          elem: "input",
          type: "number",
          label: "Annotation Id",
          optional: true
        }
      }
    },

    _setup: function( options ) {
      var DV = window.DV = window.DV || {},
          that = this;

      //setup elem...
      function load() {
        DV.loaded = false;
        // swap .html URL to .js for API call
        var url = options.url.replace( /\.html$/, ".js" ),
          target = options.target,
          targetDiv = document.getElementById( target ),
          containerDiv = document.createElement( "div" ),
          containerDivSize = Popcorn.position( targetDiv ),
          // need to use size of div if not given
          width = options.width || containerDivSize.width,
          height = options.height || containerDivSize.height,
          sidebar = options.sidebar || true,
          text = options.text || true,
          pdf = options.pdf || true,
          showAnnotations = options.showAnnotations || true,
          zoom = options.zoom || 700,
          search = options.search || true,
          page = options.page,
          container;

        function setOptions( viewer ) {
          options._key = viewer.api.getId();

          options._changeView = function ( viewer ) {
            if ( options.aid ) {
              viewer.pageSet.showAnnotation( viewer.api.getAnnotation( options.aid ) );
            } else {
              viewer.api.setCurrentPage( options.page );
            }
          };
        }

        function documentIsLoaded( url ) {
          var found = false;
          Popcorn.forEach( DV.viewers, function( viewer, idx ) {
            if( viewer.api.getSchema().canonicalURL === url ) {
              var targetDoc;
              setOptions( viewer );
              targetDoc = documentRegistry[ options._key ];
              options._containerId = targetDoc.id;
              targetDoc.num += 1;
              found = true;
              DV.loaded = true;
            }
          });
          return found;
        }

        function createRegistryEntry() {
          var entry = {
            num: 1,
            id: options._containerId
          };
          documentRegistry[ options._key ] = entry;
          DV.loaded = true;
        }

        if ( !documentIsLoaded( options.url ) ) {

          containerDiv.id = options._containerId = Popcorn.guid( target );
          container = "#" + containerDiv.id;
          targetDiv.appendChild( containerDiv );
          that.trigger( "documentready" );

          // Figure out if we need a callback to change the page #
          var afterLoad = options.page || options.aid ?
            function( viewer ) {
              setOptions( viewer );
              options._changeView( viewer );
              containerDiv.style.visibility = "hidden";
              viewer.elements.pages.hide();
              createRegistryEntry();
            } :
            function( viewer ) {
              setOptions( viewer );
              createRegistryEntry();
              containerDiv.style.visibility = "hidden";
              viewer.elements.pages.hide();
            };
          DV.load( url, {
            width: width,
            height: height,
            sidebar: sidebar,
            text: text,
            pdf: pdf,
            showAnnotations: showAnnotations,
            zoom: zoom,
            search: search,
            container: container,
            afterLoad: afterLoad
          });
        }
      }
      function readyCheck() {
        if( window.DV.loaded ) {
          load();
        } else {
          setTimeout( readyCheck, 25 );
        }
      }

      // If the viewer is already loaded, don't repeat the process.
      if ( !DV.loading ) {
        DV.loading = true;
        DV.recordHit = "//www.documentcloud.org/pixel.gif";

        var link = document.createElement( "link" ),
            head = document.getElementsByTagName( "head" )[ 0 ];

        link.rel = "stylesheet";
        link.type = "text/css";
        link.media = "screen";
        link.href = "//s3.documentcloud.org/viewer/viewer-datauri.css";

        head.appendChild( link );

        // Record the fact that the viewer is loaded.
        DV.loaded = false;

        // Request the viewer JavaScript.
        Popcorn.getScript( "http://s3.documentcloud.org/viewer/viewer.js", function() {
          DV.loading = false;
          load();
        });
      } else {

        readyCheck();
      }

      options.toString = function() {
        // use the default option if it doesn't exist
        return options.src || options._natives.manifest.options.src[ "default" ];
      };
    },

    start: function( event, options ) {
      var elem = document.getElementById( options._containerId ),
          viewer = DV.viewers[ options._key ];
      ( options.page || options.aid ) && viewer &&
        options._changeView( viewer );

      if ( elem && viewer) {
        elem.style.visibility = "visible";
        viewer.elements.pages.show();
      }
    },

    end: function( event, options ) {
      var elem = document.getElementById( options._containerId );

      if ( elem && DV.viewers[ options._key ] ) {
        elem.style.visibility = "hidden";
        DV.viewers[ options._key ].elements.pages.hide();
      }
    },

    _teardown: function( options ) {
      var elem = document.getElementById( options._containerId ),
          key = options._key;
      if ( key && DV.viewers[ key ] && --documentRegistry[ key ].num === 0 ) {
        DV.viewers[ key ].api.unload();

        while ( elem.hasChildNodes() ) {
          elem.removeChild( elem.lastChild );
        }
        elem.parentNode.removeChild( elem );
      }
    }
  });
})( Popcorn, window.document );
// PLUGIN: Timeline
(function ( Popcorn ) {

  /**
     * timeline popcorn plug-in
     * Adds data associated with a certain time in the video, which creates a scrolling view of each item as the video progresses
     * Options parameter will need a start, target, title, and text
     * -Start is the time that you want this plug-in to execute
     * -End is the time that you want this plug-in to stop executing, tho for this plugin an end time may not be needed ( optional )
     * -Target is the id of the DOM element that you want the timeline to appear in. This element must be in the DOM
     * -Title is the title of the current timeline box
     * -Text is text is simply related text that will be displayed
     * -innerHTML gives the user the option to add things such as links, buttons and so on
     * -direction specifies whether the timeline will grow from the top or the bottom, receives input as "UP" or "DOWN"
     * @param {Object} options
     *
     * Example:
      var p = Popcorn("#video")
        .timeline( {
         start: 5, // seconds
         target: "timeline",
         title: "Seneca",
         text: "Welcome to seneca",
         innerHTML: "Click this link <a href='http://www.google.ca'>Google</a>"
      } )
    *
  */

  var i = 1;

  Popcorn.plugin( "timeline" , function( options ) {

    var target = document.getElementById( options.target ),
        contentDiv = document.createElement( "div" ),
        container,
        goingUp = true;
    return {

      _setup: function ( options ) {
        options.id = options.id || "timelineDiv" + i;
        if (!target) {
          target = document.querySelector('body').appendChild(document.createElement('div'));
          target.id = options.target;
        }
        container = target.querySelector(`#${options.id}`);

        if ( !container ) {
          container = document.createElement( "div" );
          target.appendChild ( container );
          container.style.width = "inherit";
          container.style.height = "inherit";
          container.style.overflow = "auto";
          container.id = options.id;
          container.classList.add("timeline-plugin");
        } 

        //  Default to up if options.direction is non-existant or not up or down
        options.direction = options.direction || "up";
        if ( options.direction.toLowerCase() === "down" ) {
          goingUp = false;
        }
 
        // if this isnt the first div added to the target div
        if( goingUp ){
          console.log('going up');
            // insert the current div before the previous div inserted
            container.insertBefore( contentDiv, container.firstChild );
          }
        else {

            container.appendChild( contentDiv );
        }
        contentDiv.style.display = "none";
        contentDiv.classList.add("timeline-plugin-item");

        options.innerHTML = options.innerHTML || "";

        contentDiv.innerHTML =`${options.title ?"<h3 >" + options.title + "</h3>" : ""}
${options.text? "<p>" + options.text + "</p>" : ""} ${options.innerHTML}`;


        // console.log(contentDiv.textContent);
        i++;

      },

    start: function( event, options ) {
        contentDiv.style.display = "block";

        if( options.direction === "down" ) {
          container.scrollTop = container.scrollHeight;
        }
      },

      end: function( event, options ) {
        contentDiv.style.display = "none";
      },

      _teardown: function( options ) {

        ( container && contentDiv ) && container.removeChild( contentDiv ) && !container.firstChild && target.removeChild( container );
      }
    };
  },
  {

    about: {
      name: "Popcorn Timeline Plugin",
      version: "0.1",
      author: "David Seifried @dcseifried",
      website: "dseifried.wordpress.com"
    },

    options: {
      start: {
        elem: "input",
        type: "number",
        label: "Start"
      },
      end: {
        elem: "input",
        type: "number",
        label: "End"
      },
      target: "feed-container",
      title: {
        elem: "input",
        type: "text",
        label: "Title"
      },
      text: {
        elem: "input",
        type: "text",
        label: "Text"
      },
      innerHTML: {
        elem: "input",
        type: "text",
        label: "HTML Code",
        optional: true
      },
      direction: {
        elem: "select",
        options: [ "DOWN", "UP" ],
        label: "Direction",
        optional: true
      }
    }
  });

})( Popcorn );
// PLUGIN: Footnote/Text

(function ( Popcorn ) {

  /**
   * Footnote popcorn plug-in
   * Adds text to an element on the page.
   * Options parameter will need a start, end, target and text.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing
   * Text is the text that you want to appear in the target
   * Target is the id of the document element that the text needs to be
   * attached to, this target element must exist on the DOM
   *
   * @param {Object} options
   *
   * Example:
   *  var p = Popcorn('#video')
   *    .footnote({
   *      start: 5, // seconds
   *      end: 15, // seconds
   *      text: 'This video made exclusively for drumbeat.org',
   *      target: 'footnotediv'
   *    });
   **/

  var i = 0;
  Popcorn.plugin( "footnote", {

    manifest: {
      about: {
        name: "Popcorn Footnote Plugin",
        version: "0.2",
        author: "@annasob, @rwaldron",
        website: "annasob.wordpress.com"
      },
      options: {
        start: {
          elem: "input",
          type: "number",
          label: "Start"
        },
        end: {
          elem: "input",
          type: "number",
          label: "End"
        },
        text: {
          elem: "input",
          type: "text",
          label: "Text"
        },
        id: {
          elem: "input",
          type: "text",
          label: "ID"
        },
        target: "footnote-container"
      }
    },

    _setup: function( options ) {

      var target = Popcorn.dom.find( options.target );

      options._container = document.createElement( "div" );
      options._container.style.display = "none";
      options._container.id = options.id || `footnotediv${i}`;
      options._container.classList.add("footnote-plugin");
      options._container.innerHTML  = options.text;
      i++;
      target.appendChild( options._container );
    },

    /**
     * @member footnote
     * The start function will be executed when the currentTime
     * of the video  reaches the start time provided by the
     * options variable
     */
    start: function( event, options ){
      options._container.style.display = "inline";
    },

    /**
     * @member footnote
     * The end function will be executed when the currentTime
     * of the video  reaches the end time provided by the
     * options variable
     */
    end: function( event, options ){
      options._container.style.display = "none";
    },

    _teardown: function( options ) {
      var target = Popcorn.dom.find( options.target );
      if ( target ) {
        target.removeChild( options._container );
      }
    }

  });
})( Popcorn );
// PLUGIN: WEBPAGE

(function ( Popcorn ) {

  /**
   * Webpages popcorn plug-in
   * Creates an iframe showing a website specified by the user
   * Options parameter will need a start, end, id, target and src.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing
   * Id is the id that you want assigned to the iframe
   * Target is the id of the document element that the iframe needs to be attached to,
   * this target element must exist on the DOM
   * Src is the url of the website that you want the iframe to display
   *
   * @param {Object} options
   *
   * Example:
     var p = Popcorn('#video')
        .webpage({
          id: "webpages-a",
          start: 5, // seconds
          end: 15, // seconds
          src: 'http://www.webmademovies.org',
          target: 'webpagediv'
        } )
   *
   */
  var i = 0;
  Popcorn.plugin( "webpage" , {
    manifest: {
      about: {
        name: "Popcorn Webpage Plugin",
        version: "0.2",
        author: "@annasob, @titaniumbones",
        website: "annasob.wordpress.com"
      },
      options: {
        id: {
          elem: "input",
          type: "text",
          label: "Id",
          optional: true
        },
        start: {
          elem: "input",
          type: "number",
          label: "Start"
        },
        end: {
          elem: "input",
          type: "number",
          label: "End"
        },
        src: {
          elem: "input",
          type: "url",
          label: "Webpage URL",
          "default": "http://mozillapopcorn.org"
        },
        target: "iframe-container"
      }
    },
    _setup: function( options ) {

      var target = document.getElementById( options.target );

      // make src an iframe acceptable string
      // actually skip this or local runs fail
      // options.src = options.src.replace( /^(https?:)?(\/\/)?/, "//" );

      // make an iframe
      options._iframe = document.createElement( "iframe" );
      options._iframe.classList.add("webpage-plugin")
      options._iframe.style.width = "100%" ;
      options._iframe.style.display = "none";
      // not sure what a good default would actually look like
      // for now setting in CSS using new class
      //options._iframe.style.minHeight = "100%";
      options._iframe.id = options.id || `webpageframe${i}`;
      options._iframe.src = options.src;

      // add the hidden iframe to the DOM
      target && target.appendChild( options._iframe );

    },
    /**
     * @member webpage
     * The start function will be executed when the currentTime
     * of the video  reaches the start time provided by the
     * options variable
     */
    start: function( event, options ){
      // make the iframe visible
      options._iframe.src = options.src;
      options._iframe.style.display = "inline";
    },
    /**
     * @member webpage
     * The end function will be executed when the currentTime
     * of the video  reaches the end time provided by the
     * options variable
     */
    end: function( event, options ){
      // make the iframe invisible
      options._iframe.style.display = "none";
    },
    _teardown: function( options ) {

      document.getElementById( options.target ) && document.getElementById( options.target ).removeChild( options._iframe );
    }
  });
})( Popcorn );
