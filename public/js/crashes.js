function CrashController($scope, $http, $location, $window) {

    'use strict';

    new Common($scope, $http, $location);

    $scope.search = function search(name, defaultValue) {
        var value = $location.search()[name];
        if (value === undefined) {
            return defaultValue;
        }
        if (value === 'true') {
            return true;
        } else if (value === 'false') {
            return false;
        }
        return value;
    };

    $scope.total = 0;

    $scope.settings = new CrashSettings($scope);
    $scope.summary = {};

    $scope.settingsText = function () {
        var val = 'off: ';
        $.each($scope.settings, function (key, value) {
            if (key === 'sinks') {
                //do nothing
            } else if (!value) {
                val += key + ' ';
            }
        });
        return val;
    };

    $scope.loadData = function loadData() {
        $scope.refreshDiv();
        var config = {params: $scope.settings};
        var bounds = $scope.map.getBounds();
        var corners = {
            north: $scope.latlng(bounds.getNorthEast().lat),
            south: $scope.latlng(bounds.getSouthWest().lat),
            east: $scope.latlng(bounds.getNorthEast().lng),
            west: $scope.latlng(bounds.getSouthWest().lng)
        };
        var url = $scope.host + 'crashes/' + corners.north + '/' + corners.south + '/'
            + corners.east + '/' + corners.west + '?callback=JSON_CALLBACK';
        config.params.zoom = $scope.map.getZoom();
        var center = $scope.map.getCenter();
        config.params.lat = $scope.latlng(center.lat);
        config.params.lng = $scope.latlng(center.lng);
        $http.jsonp(url, config)
            .success(function (data, status, headers) {
                $scope.windowTotal = '';
                $scope.fixedTotal = '';
                if ($scope.settings.scope === 'Window') {
                    $scope.windowTotal = data.total;
                } else {
                    $scope.fixedTotal = data.total;
                }
                if (data.data.length == 0) {
                    //this is to get around a bug in heatmap.js with no data
                    data.data.push({count: 1, lat: "-45.468", lng: "122.436"});
                    data.max = 1;
                }
                $scope.heatMapOverlay.setData(data);
                for (var prop in data.summary) {
                    $scope.summary[prop] = $scope.percents(data.summary[prop] / data.total);

                }
                $('.refreshDiv').attr('class', 'refreshDiv well hidden');
            }).error(function (data, status, headers) {
                $('.refreshDiv').text('Unable to load data from remote server');

            });

        $location.search($scope.settings);

    };

    $scope.config = function config() {
        var legendCanvas = document.createElement('canvas');
        legendCanvas.width = 100;
        legendCanvas.height = 10;
        var min = document.querySelector('#min');
        var max = document.querySelector('#max');
        var gradientImg = document.querySelector('#gradient');
        var legendCtx = legendCanvas.getContext('2d');
        var gradientCfg = {};
        var gradient = { 0.05: "rgb(0,0,255)", 0.35: "rgb(0,255,0)", 0.65: "yellow", .95: "rgb(255,0,0)"};
        if ($scope.settings.colors === 'orrd') {
            //http://colorbrewer2.org/?type=sequential&scheme=OrRd&n=4
            gradient = { '.05': '#fef0d9', '.35': '#fdcc8a', '.65': '#fc8d59', '.95': "#d7301f"};
        }
        return {
            "radius": 35,
            "maxOpacity": 1,
            "useLocalExtrema": false,
            latField: 'lat',
            lngField: 'lng',
            valueField: 'count',
            gradient: gradient,
            onExtremaChange: function updateLegend(data) {
                min.innerHTML = 1;
                max.innerHTML = data.max;
                if (data.gradient != gradientCfg) {
                    gradientCfg = data.gradient;
                    var gradient = legendCtx.createLinearGradient(0, 0, 100, 1);
                    for (var key in gradientCfg) {
                        gradient.addColorStop(key, gradientCfg[key]);
                    }
                    legendCtx.fillStyle = gradient;
                    legendCtx.fillRect(0, 0, 100, 10);
                    gradientImg.src = legendCanvas.toDataURL();
                }
            }
        };
    };

    function addSinks() {
        $scope.sinks = L.layerGroup();

        $http.get($scope.host + 'sinks')
            .success(function (data, status, headers) {
                data.forEach(function (point) {
                    var marker = L.marker([point.lat, point.lng]);
                    var source = point.source || 'odot';
                    marker.bindPopup(point.lat + ', ' + point.lng + ' source:' + source);
                    var circle = L.circle([point.lat, point.lng], 13, {
                        color: 'red',
                        weight: 2,
                        fillOpacity: 0
                    });
                    $scope.sinks.addLayer(marker);
                    $scope.sinks.addLayer(circle);
                });

            }).error(function (data, status, headers) {
                console.log('unable to load sinks', status);
            });
    }

    function tooltip() {

        var tooltip = document.querySelector('.tooltip-area');

        function updateTooltip(x, y, value) {
            // + 15 for distance to cursor
            var transform = 'translate(' + (x + 15) + 'px, ' + (y + 15) + 'px)';
            tooltip.style.MozTransform = transform; /* Firefox */
            tooltip.style.msTransform = transform; /* IE (9+) - note ms is lowercase */
            tooltip.style.OTransform = transform; /* Opera */
            tooltip.style.WebkitTransform = transform; /* Safari and Chrome */
            tooltip.style.transform = transform; /* One day, my pretty */
            if (value < 10) {
                tooltip.style.width = '9px';
            } else if (value < 100) {
                tooltip.style.width = '17px';
            } else if (value < 1000) {
                tooltip.style.width = '26px';
            } else if (value < 10000) {
                tooltip.style.width = '36px';
            }
            tooltip.innerHTML = value;

        }

        var wrapper = document.querySelector('.map-wrapper');

        wrapper.onmousemove = function(ev) {
            var x = ev.layerX;
            var y = ev.layerY;

            var value = $scope.heatMapOverlay._heatmap.getValueAt({ x: x, y: y});
            tooltip.style.display = 'block';

            updateTooltip(x, y, value);
        };
        wrapper.onmouseout = function() {
            tooltip.style.display = 'none';
        };
    }

    var subDomains = ['gistiles1', 'gistiles2', 'gistiles3', 'gistiles4'];
    var token = 'token=O95k2qhvXt3RArC0yQV5j4JinWb21wL0wLj2Ik-dLG0.';
    var attribution = "<a href='//gis.oregonmetro.gov'>Metro RLIS</a>";
    var road = L.tileLayer('https://{s}.oregonmetro.gov/arcgis/rest/services/metromap/baseAll/MapServer/tile/{z}/{y}/{x}?' + token, {
        subdomains: subDomains,
        attribution: attribution,
        opacity: 0.5
    });
    var photo = L.tileLayer('https://{s}.oregonmetro.gov/arcgis/rest/services/photo/2013aerialphoto/MapServer/tile/{z}/{y}/{x}?' + token, {
        subdomains: subDomains,
        zIndex: 10,
        opacity: 0.5,
        attribution: attribution
    });
    var xtraphoto = L.tileLayer('//server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: "<a href='//www.esri.com'>ESRI</a>",
        opacity: 0.5,
        zIndex: 0
    });
    var label = L.tileLayer('https://{s}.oregonmetro.gov/arcgis/rest/services/metromap/baseAnno/MapServer/tile/{z}/{y}/{x}?' + token, {
        subdomains: subDomains,
        opacity: 0.5,
        zIndex: 100,
        attribution: attribution
    });

    var x= new RLIS.Autosuggest("autosuggest", {"mode":'locate','entries':7} ,function (result, error){
        if (error) {
            alert(error);
            return;
        }
        L.marker([result[0].lat, result[0].lng]).addTo($scope.map);
        $scope.map.setView([result[0].lat, result[0].lng], 16);
    }, 'lat,lng,fullAddress');

    $('#clearForm').on('click', function(){
        $('#autosuggest').val('');
    });

    function windowOnLoad() {
        var loadlat = Number($scope.search('lat', 45.48));
        var loadlng = Number($scope.search('lng', -122.74));
        var layers = [];
        layers.push(road);
        $scope.heatMapOverlay = new HeatmapOverlay($scope.config());
        layers.push($scope.heatMapOverlay);

        $scope.map = new L.map('heatmapArea', {
            center: new L.LatLng(loadlat, loadlng),
            maxZoom: 19,
            zoom: $scope.settings.zoom,
            zoomControl: false,
            layers: layers
        });

        var legend = L.Control.extend({
            options: {
                position: 'topright'
            },

            onAdd: function (map) {
                // create the control container with a particular class name
                var layoutcontainer = L.DomUtil.get('searchControl');
                L.DomEvent.disableClickPropagation(layoutcontainer);
                $("#searchControl").show(10);
                return layoutcontainer;
            }
        });

        addSinks();

        var photoGroup = L.layerGroup([photo, xtraphoto, label]);

        var baseMaps = {
            "road ": road,
            "air photo": photoGroup
        };

        $scope.map.addControl(new legend());
        $scope.map.addControl( L.control.zoom({position: 'topright'}) );

        L.control.layers(baseMaps).addTo($scope.map);

        $scope.map.on('moveend', function (e) {
            $scope.loadData();
        });

        $('#changeSettings').show();
        $('#settingsTable').show();
        if ($window.innerWidth > 978) {
            $('#settingsTable').collapse('show');
        }

        $('#settingsTable').on('hidden', function () {
            $('#settingsText').show();
        });

        $('#settingsTable').on('show', function () {
            $('#settingsText').hide();
        });

        $scope.loadData();
        $scope.showSinks();
        tooltip();
    }

    $scope.showSinks = function showSinks() {
        if ($scope.settings.sinks) {
            $scope.map.addLayer($scope.sinks);
        } else {
            $scope.map.removeLayer($scope.sinks);
        }
    };

    windowOnLoad();

    $scope.reloadPage = function(){
        $location.search($scope.settings);
        window.location.reload();
    }
}
