import { parseTime } from './parsetime';

(function(window, document, undefined){
    'use strict';

    window.ytembedcache = {};

    const YTImageEmbed = cfworkerURL => {

        // utility and settings
        const workerURL = cfworkerURL || window.ytembedworkerurl;
        const idRegex = /^[a-zA-Z0-9-_]{11}$/;
        const ytURLRegex = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        
        // utility functions
        const validateID = id =>  idRegex.test(id); 
        const getVideoID = yturl => {
            const match = yturl.match(ytURLRegex);
            if (match && match[2].length == 11) 
                return match[2];
            else if(validateID(yturl))
                return yturl;
            return false;
        }
        const getData = ( element, name ) => element.getAttribute(`data-${name}`);
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);

        const filterFormatsforEmbed = formats => {
            //const isNotDashURL = format => /\/manifest\/dash\//.test(format.url);
            const hasAudio = format => !!format.audioBitrate || !!format.audioSampleRate;
            const hasVideo = format => !!format.qualityLabel
            const filterfn = format => hasVideo(format) && !hasAudio(format);
            return formats.filter(format => filterfn(format));
        }
        

        /**
         * Fetch ytdl info object from ytdl cloudflare worker on cache miss.
         *  
         * @param {string} id 
         */
        const fetchOrCache = async (id) => {
            let info = window.ytembedcache[id];
            if(info) return info;
            const url = new URL(`info/${id}`, workerURL);
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'follow'                
            });
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") === -1)
                throw new Error(await response.text());
            
            info = await response.json();
            return info; 
        }

        /**
         * Finds suitable formats (video only) and resolution requirement based on largest required image width.
         * 
         * @param {string} id youtube video id
         * @param {*} largestWidth To select optimal video size while maintaning quality.
         */
        const addSuitableFormats = async (id, largestWidth) => {
            const info = await fetchOrCache(id);
            const formats = filterFormatsforEmbed(info.formats) || info.formats;
            let suitableFormat;

            if ( largestWidth >= formats[0].width ){
                return [ formats[0].url, formats[0].width / formats[0].height ];
            }
            for (const [indx, format] of formats.entries()) {
                if(largestWidth > format.width){
                    suitableFormat = formats[indx-1];
                    break;
                }
            }
            if ( !suitableFormat ) suitableFormat = formats.pop();
            return [ suitableFormat.url, suitableFormat.width / suitableFormat.height ];
            
        }
        /**
         * Adds Image as canvas element under given element using video url and timestamp
         * 
         * @param {object} data id, timestamp, width, height and element
         * @param {string} url  Video url 
         * @param {Number} aspectRatio  Video aspect ratio to calculate height (if missing) 
         */
        const addImage = async (data, url, aspectRatio) => {
            const videoEle = document.createElement('video');
            videoEle.muted = true;
            videoEle.preload = 'metadata';
            const canvasEle = document.createElement('canvas'); 
            canvasEle.width = data.iWidth;
            canvasEle.height = data.iHeight ? data.iHeight : canvasEle.width / aspectRatio;
            const context = canvasEle.getContext('2d');
            const makeCanvas = async () => {
                videoEle.onseeked = event => {
                    context.drawImage(videoEle, 0, 0, canvasEle.width, canvasEle.height);
                    // reseting source to stop video buffering and save data
                    videoEle.src = '';
                    videoEle.load();
                    data.element.appendChild(canvasEle);
                };
                videoEle.currentTime = data.time;
            }

            // make Image on metadata load
            videoEle.onloadedmetadata = event => { 
                if(videoEle.duration >= data.time ) makeCanvas();
                else console.log(`Timestamp exceeds duration of video id=${data.id}`);
             } ;
            // Using media fragment to reduce data consumption on buffer
            videoEle.src = `${url}#t=${data.time},${data.time+1}`;
        }

        /**
         * load image on a single element
         * @param {string|Node.Element} elemOrSelector 
         */
        const load = async (elemOrSelector) => {
            if(!elemOrSelector) return;
            let elem = elemOrSelector;
            if (typeof elemOrSelector === 'string' || elemOrSelector instanceof String)
                elem = document.querySelector(elemOrSelector);
           
            if(!elem) throw Error("load() requires a valid element node or selector string");
            const t = getData(elem, 'time');
            const urlOrID = getData(elem, 'url');

            if ( !urlOrID ) return;
            const id = getVideoID(urlOrID);
            if( !t ) {
                setThumbnail(elem, id);
                return;
            }

            const data = {
                id: id,
                time: parseTime(t)/1000, // to seconds
                iWidth: parseInt(getData(elem, 'width')) || elem.clientWidth || elem.parentElement.clientWidth || window.screen.width,
                iHeight: getData(elem, 'height'),
                element: elem
            };

            const [url, aspectRatio] = await addSuitableFormats(k, largestWidth);
            addImage(data, url, aspectRatio);

        }

        /**
         * Set thumbnail of yt video (used in case of invalid timestamp) 
         * 
         * @param {*} elem 
         * @param {*} id 
         */
        const setThumbnail = async (elem, id) => {
            const img = new Image();
            img.src = `https://img.youtube.com/vi_webp/${id}/maxresdefault.webp`;
            elem.appendChild(img);
            console.log(`No time was provided for screenshot. Setting thumbnail.\n${elem}`);
        }

        /**
         * loads yt image on all elements with `yt-image-embed` class.
         */
        const loadAll = async () => {
            let d = {}
            for ( const elem of document.querySelectorAll(".yt-image-embed") ) {

                const t = getData(elem, 'time');
                const urlOrID = getData(elem, 'url');

                if ( !urlOrID ) continue;

                const id = getVideoID(urlOrID);
                
                // if no timestamp given put thumbnail
                if ( !t ) {
                    setThumbnail(elem, id);
                    continue;
                }

                if ( d[id] === undefined ) d[id] = [];

                d[id].push( {
                    id: id,
                    time: parseTime(t)/1000, // to seconds
                    // data-width > elem.width > elem.parent.width > window
                    iWidth: parseInt(getData(elem, 'width')) || elem.clientWidth || elem.parentElement.clientWidth || window.screen.width,
                    iHeight: getData(elem, 'height'),
                    element: elem,
                });
            }
            Object.entries(d).forEach( ([k, v]) => {
                const largestWidth = v.reduce( (max, curr) => curr.iWidth > max ? curr.iWidth : max, v[0].iWidth);
                addSuitableFormats(k, largestWidth)
                .then( ([url, aspectRatio]) => {
                    v.forEach(async (data) => {
                        addImage(data, url, aspectRatio);
                    });
                });
            });
        };

        window.ytembedworkerurl = workerURL;
        return { load: load, loadAll: loadAll }
    }

    window.YTIE = YTImageEmbed;

})(window, document, undefined);