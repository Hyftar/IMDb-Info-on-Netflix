// ==UserScript==
// @name         IMDb Info On Netflix
// @description  Detailed IMDB info to Netflix titles
// @namespace    http://tampermonkey.net/
// @version      1.3
// @author       Hyftar
// @match        https://www.netflix.com/browse
// @match        https://www.netflix.com/title/*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.1.0/jquery.min.js
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  window.titlesIdCache = {}
  window.titlesRatingCache = {}

  $('head')
    .append(
      `<style>
        a.slnk {
          margin-left: 10px;
          margin-top:5px;
        }

        a.slnk img {
          width: 25px;
          height: 25px;
        }

        .previewModal-episodeDetail-and-badge .imdbInfoLoading
        ,.previewModal-episodeDetail-and-badge .imdbLogo {
          margin-left: 1em;
        }

        .previewModal-episodeDetail-and-badge {
          display: flex;
          align-items: center;
        }
      </style>`
    );

  let isInfoLoaded = false;

  //main loop
  const intervalId = setInterval(
    function () {
      if ($('.imdbRating').length === 0
        && $('.imdbInfoLoading').length === 0) {
        isInfoLoaded = false;
      }

      if ($('.PlayerControlsNeo__button-control-row').length !== 0) {
        clearInterval(intervalId);

        return;
      }

      if (isInfoLoaded) {
        return;
      }

      if ($('.previewModal--detailsMetadata-right').length !== 0) {
        isInfoLoaded = true;
        loadImdbScorePreviewModal();

        return;
      }

      if ($('.previewModal--info').length !== 0) {
        isInfoLoaded = true;
        loadImdbScoreInfoModal();

        return;
      }
    },
    500
  );

  function loadImdbScoreInfoModal() {
    const title = $('.previewModal--boxart')[0].alt;

    if (title === undefined) {
      return;
    }

    loadRatingAsync(title);
  }

  function loadImdbScorePreviewModal() {
    const title = $('.playerModel--player__storyArt')[0].alt;

    if (title === undefined) {
      return;
    }

    loadRatingAsync(title);
  }

  async function loadRatingAsync(title) {
    const loadingElem =
      $('<img>')
        .attr('src', "https://i.imgur.com/1Aatim3.gif")
        .attr('width', 20)
        .attr('class', "imdbInfoLoading")

    loadingElem.appendTo('.videoMetadata--container:first');
    loadingElem.clone().appendTo('.previewModal-episodeDetail-and-badge')

    const imdbInfo = await getImdbInfoFromTitle(title);

    $('.imdbInfoLoading').remove()
    $('.imdbLogo').remove()
    $('.imdbRating').remove()

    const color = getRatingColor(imdbInfo);

    const imdbUrl = 'https://www.imdb.com' + imdbInfo.url;

    const imdbLogoElem =
      $('<a>')
        .attr('class', 'imdbLogo')
        .attr('href', imdbUrl)
        .attr('target', '_blank')
        .addClass('slnk')
        .html('<img src="https://i.imgur.com/uKZrahf.png">');

    imdbLogoElem.appendTo('.videoMetadata--container:first');
    imdbLogoElem.clone().appendTo('.previewModal-episodeDetail-and-badge');

    const imdbInfoElem =
      $('<b>')
        .attr('class', 'imdbRating')
        .attr('span', imdbUrl)
        .attr('style', "line-height:25px; margin-left: 5px; color:" + color)
        .html(imdbInfo.rating);

    imdbInfoElem.appendTo('.videoMetadata--container:first');
    imdbInfoElem.clone().appendTo('.previewModal-episodeDetail-and-badge');
  }

  async function getImdbInfoFromTitle(title) {
    const imdbId = await getImdbIdFromTitle(title);

    return getImdbInfoFromId(imdbId);
  }

  async function getImdbIdFromTitle(title) {
    if (window.titlesIdCache[title] !== undefined) {
      return Promise.resolve(window.titlesIdCache[title]);
    }

    const encodedUrl = encodeURIComponent(title)

    return new Promise(
      function (resolve, reject) {
        GM_xmlhttpRequest({
          method: 'GET',
          responseType: 'document',
          synchronous: false,
          url: 'https://www.imdb.com/find?s=tt&q=' + encodedUrl,
          onload: (resp) => {
            const doc = document.implementation.createHTMLDocument().documentElement;
            doc.innerHTML = resp.responseText;

            const link =
              Array.from(doc.querySelectorAll('.result_text > a'))
                .find((el) => !el.parentNode.textContent.trim().match(/\((?:TV Episode|Short|Video Game|Video)\)/));

            const id = link?.href.match(/title\/(tt\d+)/)[1];

            if (id === undefined || id === null) {
              return reject(`Error getting IMDb id for ${title}`);
            }

            window.titlesIdCache[title] = id;

            return resolve(id);
          }
        });
      }
    );
  }

  function getImdbInfoFromId(id) {
    if (window.titlesRatingCache[id] !== undefined) {
      return Promise.resolve(window.titlesRatingCache[id]);
    }

    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: 'GET',
        responseType: 'document',
        synchronous: false,
        url: `https://www.imdb.com/title/${id}/`,
        onload: (resp) => {
          const doc = document.implementation.createHTMLDocument().documentElement;
          doc.innerHTML = resp.responseText;

          const jsonData = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
          const data = {
            id,

            url: jsonData.url,
            title: jsonData.name,
            datePublished: jsonData.datePublished,
            description: jsonData.description,
            rating: jsonData.aggregateRating.ratingValue,
            votes: jsonData.aggregateRating.ratingCount,

            dateFetched: new Date()
          };
          if (data && data.id && data.title) {
            window.titlesRatingCache[id] = data;
            resolve(data);
          } else {
            reject('Error getting IMDb data for id ' + id);
          }
        }
      });
    });
  }

  function getRatingColor(imdbInfo) {
    if (imdbInfo.rating < 5) {
      return "#a10d0d";
    }

    if (imdbInfo.rating < 6) {
      return "#b33c2d";
    }

    if (imdbInfo.rating < 7) {
      return "#d98730";
    }

    if (imdbInfo.rating < 8) {
      return "#8bd925"
    }

    return "#2bff00"
  }
})();
