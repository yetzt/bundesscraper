#!/usr/bin/env node

/* require modules */
var fs = require("fs");
var path = require("path");
var url = require("url");

var colors = require("colors");
var scrapyard = require("scrapyard");
var moment = require("moment");

var argv = require("optimist")
	.boolean(["c","d"])
	.alias("c","cache")
	.alias("d","debug")
	.alias("v","verbose")
	.argv;

/* initialize scrapyard */
var scraper = new scrapyard({
	cache: './.storage', 
	debug: argv.d,
	timeout: 986400000,
	retries: 5,
	connections: 5 // don't increase, cducsu.de serves fake-404s without proper status code on higher connection-concurrency
});

/* configue moment */
moment.lang("de");

/* manual name translations, because some people can't decide how they want to be called */
var name_translations = {
	"Barbara Katharina Landgraf": "Katharina Landgraf",
	"Cajus Julius Caesar": "Cajus Caesar",
	"Christian von Stetten": "Christian Freiherr von Stetten",
	"Dirk Erik Fischer": "Dirk Fischer",
	"Dorothée Luise Menzner": "Dorothée Menzner",
	"Edmund Geisen": "Edmund Peter Geisen",
	"Elisabeth Paus": "Lisa Paus",
	"Erich Georg Fritz": "Erich Fritz",
	"Gabi Molitor": "Gabriele Molitor",
	"Gerd Friedrich Bollmann": "Gerd Bollmann",
	"Helmut Günter Baumann": "Günter Baumann",
	"Ingrid Remmers": "Ingrid Lieselotte Remmers",
	"Johann David Wadephul": "Johann Wadephul",
	"Josip Juratović": "Josip Juratovic",
	"Kai Boris Gehring": "Kai Gehring",
	"Klaus Peter Brähmig": "Klaus Brähmig",
	"Lars Friedrich Lindemann": "Lars Lindemann",
	"Luc Jochimsen": "Lukrezia Jochimsen",
	"Lukrezia Luise Jochimsen": "Lukrezia Jochimsen",
	"Maria Anna Klein Schmeink": "Maria Klein Schmeink",
	"Maximilian Lehmer": "Max Lehmer",
	"Memet Kılıç": "Memet Kilic",
	"Michael Georg Link": "Michael Link",
	"Michael Groß": "Michael Peter Groß",
	"Patrick Ernst Sensburg": "Patrick Sensburg",
	"Paul Georg Schäfer": "Paul Schäfer",
	"Sabine Stüber": "Sabine Ursula Stüber",
	"Sonja Steffen": "Sonja Amalie Steffen",
	"Ursula Lötzer": "Ulla Lötzer",
	"Veronika Maria Bellmann": "Veronika Bellmann",
	"Wolfgang Gehrcke Reymann": "Wolfgang Gehrcke"
};

/* global object for scrapers */
var fetch = {};

fetch.bt = function(_callback){
	var data = [];
	var base_url = "http://www.bundestag.de/bundestag/abgeordnete18/alphabet/index.html";
	scraper.scrape(base_url, "html", function(err, $){
		if (err) {
			_callback(err);
		} else {
			var _count_fetchable = 0;
			var _count_fetched = 0;
			$('.linkIntern a','#inhaltsbereich').each(function(idx, e){
				var $e = $(this);
				/* check for dead or retired members, marked by "+)" or "*)" and for "Jakob Maria Mierscheid" */
				if (!($e.text().match(/[\*\+]\)$/)) && !($(this).text().match(/Mierscheid/i))) {
					_count_fetchable++;
					var _data = {
						"name": null,
						"aliases": [],
						"url": url.resolve(base_url, $e.attr('href')),
						"fraktion": null,
						"fotos": [],
						"ausschuesse": [],
						"wahlkreis": null,
						"mandat": null,
						"kontakt": [],
						"web": []
					};
					scraper.scrape(_data.url, "html", function(err, $){
						if (err) {
							if (argv.v) console.log("[fail]".inverse.bold.red, "fetching".white, _data.url.red);
						} else {
							/* name, fraktion */
							var _title = $('h1', '#inhaltsbereich').eq(0).text().replace(/^\s+|\s+$/,'').split(', ');
							_data.name = _title[0].replace(/ \([^\)]+\)$/,'');
							_data.fraktion = _title[1];
							
							/* build aliases */
							_data.aliases.push(_data.name);
							if (_data.name.match(/^(Prof\. |Dr\. |h\.\s?c\. )/)) {
								_data.aliases.push(_data.name.replace(/(Prof\. |Dr\. |h\.\s?c\. )/g,''));
							}
							_data.aliases.forEach(function(name){
								if (name.match(/\s+[A-Z]\.\s+/)) {
									_data.aliases.push(name.replace(/\s+[A-Z]\.\s+/,' '));
								}
							});
							
							/* fotos */
							$('.bildDivPortrait', '#inhaltsbereich').each(function(idx,e){
								_data.fotos.push({
									"url": url.resolve(_data.url, $(this).find('img').attr('src')),
									"copyright": $(this).find('.bildUnterschrift p').text()
								});
							});

							/* ausschuesse */
							$('.mitgliedschaftBox', '#inhaltsbereich').each(function(idx,e){
								if ($(this).find('h2').eq(0).text().replace(/^\s+|\s+$/,'') === "Mitgliedschaften und Ämter im Bundestag") {
									$(this).find('.standardBox h3').each(function(idx,f){
										$(f).next().find('a').each(function(idx,g){
											_data.ausschuesse.push({
												"name": $(g).text(),
												"funktion": $(f).text().replace(/^\s+|\s+$/,""),
												"url": url.resolve(_data.url, $(g).attr('href'))
											});
										});
									});
								}
							});

							/* website, wahlkreis */
							$('.contextBox', '#context').each(function(idx,e){
								var _section = $(this).find('h2').text();
								switch(_section) {
									case "Kontakt":
										if ($(this).find('.standardBox .standardLinkliste .linkExtern a').length > 0) {
											$(this).find('.standardBox .standardLinkliste .linkExtern a').each(function(idx,f){
												switch($(f).text()) {
													case "bei Facebook": 
														_data.web.push({
															"service": "facebook",
															"url": $(f).attr('href')
														});
													break;
													case "bei Twitter": 
														_data.web.push({
															"service": "twitter",
															"url": $(f).attr('href')
														});
													break;
													case "bei studiVZ": 
														_data.web.push({
															"service": "studivz",
															"url": $(f).attr('href')
														});
													break;
													case "bei Xing": 
														_data.web.push({
															"service": "studivz",
															"url": $(f).attr('href')
														});
													break;
													case "Weblog": 
														_data.web.push({
															"service": "blog",
															"url": $(f).attr('href')
														});
													break;
													case "persönliche Internetseite": 
														_data.web.push({
															"service": "website",
															"url": $(f).attr('href')
														});
													break;
													default: 
														if ($(f).text().match(/^http[s]?:\/\//)) {
															_data.web.push({
																"service": "website",
																"url": $(f).attr('href')
															});
														} else {
															_data.web.push({
																"service": "unknown",
																"url": $(f).attr('href')
															});
														}
													break;
												}
											});
										}
									break;
									case "Gewählt über Landesliste": 
										_data.mandat = 'liste';
										if ($(this).find('.standardBox a[title^=Wahlkreis]','#context').length === 1) {
											_data.wahlkreis = $(this).find('.standardBox a[title^=Wahlkreis]','#context').eq(0).attr('title');
										} else {
											_data.wahlkreis = null;
										}
									break;
									case "Direkt gewählt in": 
										_data.mandat = 'direkt';
										_data.wahlkreis = $(this).find('.standardBox a[title^=Wahlkreis]','#context').eq(0).attr('title');
									break;
									case "Reden des MdB": break;
									case "Namentliche Abstimmungen": break;
									case "Informationen zur Fraktion": break;
								}
							});
							
							/* get addresses */
							
							/* why you no utf8? */
							var adr_search = (_data.aliases[(_data.aliases.length-1)])
								.replace(/ä/ig, 'ae')
								.replace(/ö/ig, 'oe')
								.replace(/ü/ig, 'ue')
								.replace(/ß/ig, 'ss')
								.replace(/ğ/ig, 'g')
								.replace(/è/ig, 'e')
								.replace(/é/ig, 'e')
								.replace(/š/ig, 's')
								.replace(/ć/ig, 'c')
								.split(/\s+/);
							var adr_search_firstname = adr_search.shift();
							var adr_search_surname = adr_search.pop();
							
							/* special cases, fixed by hand. */
							switch (adr_search_firstname+' '+adr_search_surname) {
								case "Birgitt Bender":
									adr_search_firstname = "Biggi";
									_data.aliases.push("Biggi Bender");
								break;
								case "Agnes Brugger":
									adr_search_firstname = "Agnieszka";
									_data.aliases.push("Agnieszka Brugger");
								break;
								case "Viola Cramon-Taubadel":
									adr_search_surname = "Cramon";
									_data.aliases.push("Viola Cramon");
									_data.aliases.push("Viola von Cramon");
								break;
								case "Joerg Essen":
									adr_search_surname = "Essenvan"; // so broken this shit
								break;
								case "Ursula Heinen-Esser":
									adr_search_surname = "Heinen";
									_data.aliases.push("Ursula Heinen");
								break;
								case "Sven-Christian Kindler":
									adr_search_firstname = "Sven";
									_data.aliases.push("Sven Kindler");
								break;
								case "Ulla Schmidt":
									adr_search_firstname = "Ursula";
									_data.aliases.push("Ursula Schmidt");
								break;
								case "Heinz Wichtel":
									adr_search_firstname = "Peter";
									_data.aliases.push("Peter Wichtel");
								break;
							}
							
							//hmpf

							scraper.scrape({
								url: "http://www.bundestag.de/dokumente/adressbuch/?",
								type: "html",
								method: "POST",
								form: {
									surname: adr_search_surname,
									firstname: adr_search_firstname,
									fraction: "",
									email: "",
									associatedTo: "MdB", 
									doSearch: "Suchen"
								}
							}, function(err, $){

								_count_fetched++;

								if (err) {
									if (argv.v) console.log("[fail]".inverse.bold.red, "address".white, adr_search_firstname.red, adr_search_surname.red);
								} else {
									
									if ($('.infoBox .standardBox table.standard','#container').length < 1) {
										
										if (argv.v) console.log("[fail]".inverse.bold.red, "address".white, adr_search_firstname.red, adr_search_surname.red);
										
									} else {
										
										$('.infoBox .standardBox table.standard tr','#container').each(function(idx,e){
											
											switch ($(this).find('th').text().replace(/^\s+|\s+$/g,'')) {
												
												case "Nachname": 
													_data.nachname = $(this).find('td').text().replace(/^\s+|\s+$/g,'');
												break;
												case "Vorname": 
													_data.vorname = $(this).find('td').text().replace(/^\s+|\s+$/g,'');
												break;
												case "E-Mail Adresse": 
													_data.kontakt.push({
														"type": "email",
														"address": $(this).find('td').text().replace(/^\s+|\s+$/g,'')
													});
												break;
												case "Zertifikat":
													_data.btcertuid = $(this).find('td a').eq(0).attr('href').split('uid=').pop();
												break;
												
											}
											
										});
										
									}
									
									data.push(_data);
									if (_count_fetched === _count_fetchable) {
										_callback(null, data);
									}
									
								}
							});
						}

					});
				} 
			});
		}
	});
};

fetch.wp = function(_callback){
	
	var data = [];
	var base_url = "http://de.wikipedia.org/wiki/Liste_der_Mitglieder_des_Deutschen_Bundestages_%2817._Wahlperiode%29";
	scraper.scrape(base_url, "html", function(err, $){

		if (err) {
			_callback(err);
		} else {

			var _count_fetchable = 0;
			var _count_fetched = 0;

			var data = [];
			
			$('#Abgeordnete').parent().next().next('table.prettytable.sortable').find('tr').each(function(idx,e){

				if ($(this).find('td').length === 0) return;

				if (!($(this).find('td').eq(6).text().match(/ausgeschieden|verstorben/))) {
					
					_count_fetchable++;
					
					var _data = {
						"gender": "u",
						"links": [],
						"aliases": [],
						"geburtsdatum": null,
						"geburtsort": null,
						"fotos": [],
						"fotos_links": []
					};
					_data.name = $(this).find('td').eq(0).find('a').text();
					_data.wp_url = url.resolve(base_url, $(this).find('td').eq(0).find('a').attr('href'));
					_data.geboren = $(this).find('td').eq(1).text();
					_data.bundesland = $(this).find('td').eq(3).text();
					scraper.scrape(_data.wp_url, "html", function(err, $){

						_count_fetched++;

						if (err) {
							_callback(err);
						} else {
							
							/* kategorien */
							$('ul li a','#catlinks').each(function(idx,e){
								switch ($(this).attr("title")) {
									case "Kategorie:Mann":
										_data.gender = "m";
									break;
									case "Kategorie:Frau":
										_data.gender = "f";
									break;
									case "Kategorie: Intersexueller":
										_data.gender = "i";
									break;
								}
							});
							
							/* weblinks */
							$('#Weblinks').parent().next('ul').find('a').each(function(idx,e){
								_data.links.push({
									"text": $(this).text(),
									"url": $(this).attr("href")
								});
							});
							
							/* personendaten meta */
							$('#Vorlage_Personendaten tr').each(function(idx,e){
								if ($(this).find('.metadata-label').length === 1) {
									var _val = ($(this).find('.metadata-label').next().text());
									switch($(this).find('.metadata-label').text()) {
										case "NAME":
											_data.aliases.push(_val);
										break;
										case "GEBURTSDATUM":
											_data.geburtsdatum = _val;
										break;
										case "GEBURTSORT":
											_data.geburtsort = _val;
										break;
									}
								}
							});
							
							/* bilder? */
							$('a.image', '#mw-content-text').eq(0).each(function(idx,e){
								if ($(this).attr('href').match(/\.jp(e)?g$/)) {
									_data.fotos_links.push(url.resolve(_data.wp_url, $(this).attr('href')));
								}
							});
							
						}
						
						data.push(_data);

						if (_count_fetchable === _count_fetched) {
							/* get fotos from api */
							
							var _count_fetchable_fotos = 0;
							var _count_fetched_fotos = 0;
							data.forEach(function(item){
								item.fotos_links.forEach(function(foto_url){
									var _image = foto_url.split(':').pop();
									_count_fetchable_fotos++;
									scraper.scrape("http://toolserver.org/~magnus/commonsapi.php?image="+_image, "xml", function(err, _foto){
										if (!err) {
											item.fotos.push({
												"url": _foto.response.file[0].urls[0].file[0],
												"copyright": _foto.response.file[0].uploader[0],
												"license": (typeof _foto.response.licenses[0].license === "undefined") ? foto_url : (typeof _foto.response.licenses[0].license[0].license_text_url === "undefined") ? _foto.response.licenses[0].license[0].name[0] : _foto.response.licenses[0].license[0].license_text_url[0],
												"source_url": foto_url
											});
										}
										_count_fetched_fotos++;
										if (_count_fetched_fotos === _count_fetchable_fotos) {
											_callback(null, data);
										}
									});
								});
							});
						}
					});
				}
			});
		}
	});
};

fetch.agw = function(_callback){
	
	var data = [];
	var base_url = "http://www.abgeordnetenwatch.de/abgeordnete-337-0.html";
	scraper.scrape(base_url, "html", function(err, $){

		if (err) {
			_callback(err);
		} else {
			
			var _count_fetched_pages = 0;
			var _count_fetchable = 0;
			var _count_fetched = 0;

			var _pages = [];
			_pages.push(base_url);
			
			$('.browse_pages .pages', '#content').eq(0).find('a.ReloadByPageProfiles').each(function(idx,e){
				_pages.push(url.resolve(base_url, $(this).attr('href').replace(/#.*$/,'')));
			});
			
			_pages.forEach(function(page_url){

				scraper.scrape(page_url, "html", function(err, $){

					_count_fetched_pages++;

					if (err) {
						// FIXME: unify
						_callback(err);
					} else {
						
						$('.list .card', '#content').each(function(idx,e){
							
							_count_fetchable++;
							
							var _data = {
								agw_url: url.resolve(page_url, $(this).find('a').eq(0).attr("href")),
								name: $(this).find(".title").text(),
								fotos: [],
								ausschuesse: []
							};
							
							scraper.scrape(_data.agw_url, "html", function(err, $){

								_count_fetched++;

								if (err) {
									// FIXME: whatever
								} else {
									
									// picture
									$('.portrait .portrait.bordered_left','#content').each(function(idx,e){
										_data.fotos.push({
											"url": url.resolve(_data.agw_url, $(this).find('img').eq(0).attr('src')),
											"copyright": $(this).find('.copyright').text()
										});
									});
									
									// data
									if ($('.grunddaten ','#content').find(".title_data").eq(0).parent().length === 1) {
										var _match = $('.grunddaten ','#content').find(".title_data").eq(0).parent().html().match(/<div class="title_data">([^<]+)<\/div>\n([^\n]+)\n/g);
										_match.forEach(function(_m){
											var __m = _m.match(/^<div class="title_data">([^<]+)<\/div>\n(.*)\n/);
											if (__m) {
												var __v = __m[2].replace(/^\s+|\s+$/,'').replace(/<[^>]+>/g,'');
												switch (__m[1]) {
													case "Geburtstag": 
														_data.geburtsdatum = __v;
													break;
													case "Berufliche Qualifikation": 
														_data.beruf = __v;
													break;
													case "Wohnort": 
														_data.wohnort = __v;
													break;
													case "Wahlkreis": 
														_data.wahlkreis = __v;
													break;
													case "Ergebnis": 
														_data.wahlergebnis = __v;
													break;
													case "Landeslistenplatz": 
														__v = __v.split(/, /);
														_data.listenplatz = __v[0];
														_data.liste = __v[1];
													break;
												}
											}
										});
									} else {
										if (argv.v) console.log("[fail]", _data.name, _data.agw_url);
									}
									
									/* abgeordnetenwatch.de is a big pile of junk */
									/*
									$(".ausschussmitgliedschaften .entry", "#content").each(function(idx,e){
										_data.ausschuesse.push({
											"name": $(this).find('.entry_title a').text(),
											"funktion": $(this).find('title_data').text(),
											"url": url.resolve(_data.agw_url, $(this).find('.entry_title a').attr('href'))
										});
									});
									*/
									
								}
								
								data.push(_data);
								
								if (_count_fetched_pages === _pages.length && _count_fetched === _count_fetchable) {
									// success
									_callback(null, data);
								}
								
							});
							
						});
						
					}
					
				});
				
			});
			
		}

	});
	
};

fetch.frak_spd = function(_callback){

	var data = [];
	var base_url = "http://www.spdfraktion.de/abgeordnete/all?view=list";

	scraper.scrape(base_url, "html", function(err, $){

		if (err) {
			_callback(err);
		} else {
			
			var _count_fetchable = 0;
			var _count_fetched = 0;

			$('#member_overview_list > li', '#member_overview').each(function(idx,e){
				
				_count_fetchable++;

				var _data = {
					name: $(this).find('h3 a').text(),
					frak_url: url.resolve(base_url, $(this).find('h3 a').attr('href')),
					fotos: [],
					kontakt: [],
					web: []
				};
				
				if ($(this).find('a.mail').length > 0) {
					$(this).find('a.mail').each(function(idx,e){
						_data.kontakt.push({
							"type": "email",
							"address": $(this).attr('href').replace(/^mailto:/,'')
						})
					});
				}
				
				$(this).find('.share li a').each(function(idx,f){
					_data.web.push({
						service: $(f).text(),
						url: $(f).attr("href")
					});
				});
				
				// get details
				
				scraper.scrape(_data.frak_url, "html", function(err, $){
					
					_count_fetched++;
					
					if (err) {
						
						
					} else {
						
						$('.subcr dl dt','#article_detail_header').each(function(idx,e){
							var _val = $(this).next('dd').text();
							switch ($(this).text()) {
								case "Geburtsdatum": 
									_data.geburtsdatum = _val.split(' in ').unshift(); 
									_data.geburtsort = _val.split(' in ').pop(); 
								break;
								case "Beruf:": _data.beruf = _val; break;
								case "Landesliste:": _data.liste = _val; break;
								case "Wahlkreis:": _data.wahlkreis = _val; break;
							}
						});

						// links
						
						$('.linklist li a','#article_detail_header').each(function(idx,e){
							switch($(this).text()) {
								case "Porträt auf bundestag.de": var _type = "bundestag"; break;
								case "YouTube": var _type = "youtube"; break;
								case "Reden im Videoarchiv des Bundestags": var _type = "bundestag_reden"; break;
								case "Auf twitter": var _type = "twitter"; break;
								case "Auf facebook": var _type = "facebook"; break;
								default:
									if ($(this).text().match(/^Homepage/i)) {
										var _type = "website";
									} else {
										var _type = "unknown";
									}
								break;
							}
							if ($(this).attr('href') !== '') {
								_data.web.push({
									"service": _type,
									"url": $(this).attr('href')
								});
							}
						});
						
						// foto
						$('.img_wrapper','#article_detail_header').each(function(idx,e){
							_data.fotos.push({
								"url": url.resolve(_data.frak_url, $(this).attr("href")),
								"copyright": ""
							});
						});

						// kontakt
						$('.map_box_content li', '#main').each(function(idx,e){
							
							var _name = $(this).find('h3').text();
							
							$(this).find('div span').each(function(idx,f){
								if ($(f).text().match(/^(Tel|Fax)/)) {
									// telefon | fax
									$(f).text().split(' | ').forEach(function(t){
										if (t.match(/^Tel/)){
											_data.kontakt.push({
												"type": "phone",
												"name": _name,
												"address": t.replace(/[^0-9]/g,'').replace(/^0/,'+49')
											});
										}
										if (t.match(/^Fax/)){
											_data.kontakt.push({
												"type": "fax",
												"name": _name,
												"address": t.replace(/[^0-9]/g,'').replace(/^0/,'+49')
											});
										}
									});
								} else {
									_data.kontakt.push({
										"type": "address",
										"name": _name,
										"address": $(f).text().replace(" | ",", ")
									});
								}
							});
							$(this).find('div a').each(function(idx,f){
								if ($(f).text().match(/E-Mail/)) {
									_data.kontakt.push({
										"type": "email",
										"name": _name,
										"address": $(f).attr('href').replace(/^mailto:/,'')
									});
								}
							});
						});
					}
					
					data.push(_data);
					
					if (_count_fetchable === _count_fetched) {
						
						_callback(null, data);
						
					}
					
				});
				
			});

		}
		
	});
	
};

fetch.frak_gruene = function(_callback){

	var data = [];
	var base_url = "http://www.gruene-bundestag.de/";
	var fetch_url = "http://www.gruene-bundestag.de/fraktion/abgeordnete_ID_4389869.html";

	scraper.scrape(fetch_url, "html", function(err, $){

		if (err) {
			_callback(err);
		} else {
			
			var _count_fetchable = 0;
			var _count_fetched = 0;
			
			$('.tt_content_list_item','#abgeordnete_slides_container').each(function(idx,e){
				
				_count_fetchable++;
				
				var _data = {
					name: $(this).find('.abgeordnete_text p').eq(0).find('a').text(),
					frak_url: url.resolve(base_url, $(this).find('.abgeordnete_text p').eq(0).find('a').attr("href")),
					fotos: [{
						"url": url.resolve(base_url, $(this).find('img').eq(0).attr("src")),
						"copyright": null
					}],
					web: [],
					kontakt: []
				}
				
				$(this).find('.email_link a').each(function(idx,e){
					_data.kontakt.push({
						"type": "email",
						"address": $(this).attr('href').replace(/^mailto:/,'')
					})
				})
				
				scraper.scrape(_data.frak_url, "html", function(err, $){
					
					_count_fetched++;
					
					if (err) {
						// FIXME: err
					} else {
						
						// email, telefon & fax
						$('p.bodytext', '#abgeordnete_links').each(function(idx,e){
							if ($(this).find('a.mailtolink').length !== 0) {
								/* email */
								_data.kontakt.push({
									"type": "email",
									"name": "Berliner Büro",
									"address": $(this).find('a.mailtolink').attr("href").replace(/^mailto:/,'')
								});
							} else if ($(this).find('b').length !== 0) {
								// skip
							} else {
								/* telefon fax */
								$(this).html().split('<br>').forEach(function(itm){
									itm = itm.replace(/^\s+|\s+$/g,'');
									switch(itm.substr(0,1)) {
										case "T":
											_data.kontakt.push({
												"type": "phone",
												"name": "Berliner Büro",
												"address": itm.replace(/[^0-9]/g,'').replace(/^0/,'+49')
											});
										break;
										case "F":
										_data.kontakt.push({
											"type": "fax",
											"name": "Berliner Büro",
											"address": itm.replace(/[^0-9]/g,'').replace(/^0/,'+49')
										});
										break;
									}
								});
							}
						});
						
						// links 
						$('li a','#links').each(function(idx,e){
							switch($(this).text().toLowerCase().replace(/[^a-z]/g,'')){
								case "twitter":
									_data.web.push({
										"service": "twitter",
										"url": $(this).attr('href')
									});
								break;
								case "facebook":
									_data.web.push({
										"service": "facebook",
										"url": $(this).attr('href')
									});
								break;
								case "blog":
									_data.web.push({
										"service": "blog",
										"url": $(this).attr('href')
									});
								break;
								case "youtube":
									_data.web.push({
										"service": "youtube",
										"url": $(this).attr('href')
									});
								break;
								case "portrtbeibundestagde":
									_data.web.push({
										"service": "bundestag",
										"url": $(this).attr('href')
									});
								break;
								case "verffentlichungspflichtigeangaben": break;
								default: 
									if ($(this).attr('href').toLowerCase().indexOf($(this).text().toLowerCase()) >= 0) {
										// personal website
										_data.web.push({
											"service": "website",
											"url": $(this).attr('href')
										});
									} else {
										_data.web.push({
											"service": "unknown",
											"url": $(this).attr('href')
										});
									}
								break;
							}
						});
						
						/* wahlkreis */
						$('.wk-info h4 a','#parlament').each(function(idx,e){
							_data.wahlkreis = $(this).text();
						});
						
						/* guessing arbritrary address formats */
						$('.wk-kontakt .bodytext','#parlament').each(function(idx,e){

							var _lines = [];
							$(this).html().split('<br>').forEach(function(_line){
								_lines.push(_line.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').replace(/^\s+|\s+$/g,''));
							});
														
							_lines.forEach(function(_line,idx){
								_line = _line.replace('&nbsp;',' ');
								if (_line.match(/^T. /)) {
									/* phone */
									_data.kontakt.push({
										"type": "phone",
										"name": "Wahlkreisbüro",
										"address": _line.replace(/[^0-9]/g,'').replace(/^0/,'+49')
									});
								} else if (_line.match(/^F. /)) {
									/* fax */
									_data.kontakt.push({
										"type": "fax",
										"name": "Wahlkreisbüro",
										"address": _line.replace(/[^0-9]/g,'').replace(/^0/,'+49')
									});
								} else if (_line.match(/^0[0-9]+[0-9\/ ]+$/)) {
									/* phone */
									_data.kontakt.push({
										"type": "phone",
										"name": "Wahlkreisbüro",
										"address": _line.replace(/[^0-9]/g,'').replace(/^0/,'+49')
									});
								} else if (_line.match(/^(D-)?[0-9]{5} [^0-9]+$/i)) {
									/* address */
									_data.kontakt.push({
										"type": "address",
										"name": "Wahlkreisbüro",
										"address": (_lines[idx-1]+', '+_line)
									});
								} else if (_line.match(/\(at\)|@/i)) {
									/* email */
									_data.kontakt.push({
										"type": "email",
										"name": "Wahlkreisbüro",
										"address": _line.replace(/\s*\(at\)\s*/,'@')
									});
								} 
								
							});
							
						});
						
					}
					
					data.push(_data);
					
					if (_count_fetchable === _count_fetched) {
						
						_callback(null, data);
						
					}
					
				});
				
			});

		}
		
	});
	
};

fetch.frak_linke = function(_callback){

	var data = [];
	var base_url = "http://www.linksfraktion.de/abgeordnete/";

	scraper.scrape(base_url, "html", function(err, $){

		if (err) {
			_callback(err);
		} else {
			
			var _count_fetchable = 0;
			var _count_fetched = 0;

			$('.listenElement','#layoutHaupt').each(function(idx,e){
				
				_count_fetchable++;
				
				var _data = {
					name: $(this).find('a').eq(0).attr('title'),
					frak_url: url.resolve(base_url, $(this).find('a').eq(0).attr('href')),
					fotos: [{
						"url": $(this).find('img').attr('src'),
						"copyright": null
					}],
					web: [],
					kontakt: []
				}
				
				scraper.scrape(_data.frak_url.replace(/profil\/$/,'kontakt/'), "html", function(err, $){
				
					_count_fetched++;
				
					if (err) {
						
						// err
						
					} else {
						
						$('.kontakt', '#spalte1').each(function(idx,e){
						
							var _name = $(this).find("[itemprop=name]").text();
						
							$(this).find("[itemprop=address]").each(function(idx,f){
							
								_data.kontakt.push({
									"type": "address",
									"name": _name,
									"address": $(f).find("[itemprop=street-address]").text()+', '+$(f).find("[itemprop=postal-code]").text()+' '+$(f).find("[itemprop=locality]").text()
								});
							
							});
						
							$(this).find("[itemprop=tel]").each(function(idx,f){
								_data.kontakt.push({
									"type": "phone",
									"name": _name,
									"address": $(f).text().replace(/[^0-9]/g,'').replace(/^0/,'+49')
								});
							});
						
							$(this).find("[itemprop=fax]").each(function(idx,f){
								_data.kontakt.push({
									"type": "fax",
									"name": _name,
									"address": $(f).text().replace(/[^0-9]/g,'').replace(/^0/,'+49')
								});
							});

							$(this).find("a.linkEmail").each(function(idx,f){
								_data.kontakt.push({
									"type": "email",
									"name": _name,
									"address": $(f).attr('href').replace(/^mailto:/g,'')
								});
							});
						
						});
					
						$('.inhaltElement.elemTeaser.extern', '#spalte2').each(function(idx,e){
							if ($(this).find('h3.kennung').length === 1 && $(this).find('h3.kennung').text() === "Linktipp") {
								_data.web.push({
									"service": "website",
									"url": $(this).find('a.extern').attr('href')
								});
							}
						});
					
					}
					
					data.push(_data);
					
					if (_count_fetchable === _count_fetched) {
						
						_callback(null, data);
						
					}
		
				});
				
			});

		}
		
	});
	
};

fetch.frak_cducsu = function(_callback){

	var sm_data = {};
	var base_url_sm = "http://www.cducsu.de/Titel__soziale_netzwerke/TabID__23/SubTabID__106/Abgeordnete_Netzwerke.aspx";
	
	scraper.scrape(base_url_sm, "html", function(err, $){
		
		if (!err) {
			
			$('.ListeAbg ul li .container', '#ctl00_phContentPane').each(function(idx,e){
				
				var _url = $(this).find('.abgeordnete h3 a').text();
				
				$(this).find('.netzwerke a').each(function(idx,f){
					switch($(f).find('img').attr('src').replace(/^images\/soznetwork\/logo_(.*)\.(png|gif)$/i,'$1')) {
						case "twitter":
							if (!(_url in sm_data)) sm_data[_url] = [];
							sm_data[_url].push({
								"service": "twitter",
								"url": $(f).attr('href')
							})
						break;
						case "facebook":
							if (!(_url in sm_data)) sm_data[_url] = [];
							sm_data[_url].push({
								"service": "facebook",
								"url": $(f).attr('href')
							})
						break;
						case "xing":
							if (!(_url in sm_data)) sm_data[_url] = [];
							sm_data[_url].push({
								"service": "xing",
								"url": $(f).attr('href')
							})
						break;
						case "meinvz":
							if (!(_url in sm_data)) sm_data[_url] = [];
							sm_data[_url].push({
								"service": "meinvz",
								"url": $(f).attr('href')
							})
						break;
						case "wkw":
							if (!(_url in sm_data)) sm_data[_url] = [];
							sm_data[_url].push({
								"service": "wkw",
								"url": $(f).attr('href')
							})
						break;
					}
				});
				
			});

		}
		
		/* we have social networks now */
		
		var data = [];
		var base_url = "http://www.cducsu.de/Titel__a_bis_z/TabID__23/SubTabID__24/Abgeordnete.aspx";

		scraper.scrape(base_url, "html", function(err, $){

			if (err) {
				_callback(err);
			} else {

				var _count_fetchable_sites = 0;
				var _count_fetched_sites = 0;
				var _count_fetchable = 0;
				var _count_fetched = 0;
			
				$('.Letters li a','#ctl00_phContentPane').each(function(idx,e){
				
					_count_fetchable_sites++;
				
					var base_url_letter = url.resolve(base_url, $(this).attr('href'));
					
					scraper.scrape(base_url_letter, "html", function(err, $){

						_count_fetched_sites++;

						$('.ListeAbg ul li div a','#ctl00_phContentPane').each(function(idx,e){

							_count_fetchable++;

							var _data = {
								name: $(this).text().replace(/^\s+|\s+$/g,''),
								frak_url: url.resolve(base_url_letter, $(this).attr('href')),
								fotos: [],
								web: [],
								kontakt: []
							}

							scraper.scrape(_data.frak_url, "html", function(err, $){
							
								if ($('img').eq(0).attr("src") === "http://www.cducsu.de/404/keyvisual.jpg") {
									console.error("[grr!]".red.inverse.bold, "cducsu.de delivered a fake 404".red, _data.frak_url.white);
								} else if (!err) {
									
									/* geburtsdatum, geburtsort, beruf */
									$('#ctl00_ContentPlaceHolder1_Wuc_AbgeordneteDetail1_lblAllgemein').each(function(idx,e){
										var _lines = [];
										$(this).html().split('<br>').forEach(function(_line, idx){
											_line = _line.replace(/^\s+|\s+$/g,'');
											if (_line === "") return;
											_lines.push(_line);
										});
										var _geb = _lines[0].match(/^Geboren am ([0-9\.]{10}) in (.*)$/)
										if (_geb) {
											_data.geburtsdatum = _geb[1];
											_data.geburtsort = _geb[2];
										}
										_data.beruf = _lines.pop();
									});
									
									/* wahlkreis */
									if ($('#ctl00_ContentPlaceHolder1_Wuc_AbgeordneteDetail1_lblWahlkreis').length === 1) {
										if ($('#ctl00_ContentPlaceHolder1_Wuc_AbgeordneteDetail1_lblWahlkreis').text().match(/Wahlkreis/)) {
											_data.wahlkreis = $('#ctl00_ContentPlaceHolder1_Wuc_AbgeordneteDetail1_lblWahlkreis').text().replace(/^.*Wahlkreis ([0-9]+)\).*$/,'$1');
											_data.mandat = "direkt";
										} else {
											_data.mandat = "liste";
										}
									}
									
									/* adressen */
									$('#ctl00_ContentPlaceHolder1_Wuc_AbgeordneteDetail1_lblBerlin_Kontakt').each(function(idx,e){
										var _addr = [];
										$(this).html().split('<br>').forEach(function(_line){
											_line = _line.replace(/^\s+|\s+$/g,'');
											if (_line === "") return;
											if (_line.match(/:/)) {
												switch (_line.split(':').shift()) {
													case "Tel.":
														_data.kontakt.push({
															"type": "phone",
															"name": "Berlin",
															"address": _line.replace(/[^0-9]/g,'').replace(/^0/,'+49')
														});
													break;
													case "Fax":
														_data.kontakt.push({
															"type": "fax",
															"name": "Berlin",
															"address": _line.replace(/[^0-9]/g,'').replace(/^0/,'+49')
														});
													break;
													case "E-Mail":
														_data.kontakt.push({
															"type": "email",
															"name": "Berlin",
															"address": $('a', _line).attr('href').replace(/^mailto:/g,'')
														});
													break;
												}
											} else {
												_addr.push(_line);
											}
										});
										_data.kontakt.push({
											"type": "address",
											"name": "Berlin",
											"address": _addr.join(', ')
										});
									});
									
									$('#ctl00_ContentPlaceHolder1_Wuc_AbgeordneteDetail1_lblWahlkreis_Kontakt').each(function(idx,e){
										var _addr = [];
										$(this).html().split('<br>').forEach(function(_line){
											_line = _line.replace(/^\s+|\s+$/g,'');
											if (_line === "") return;
											if (_line.match(/:/)) {
												switch (_line.split(':').shift()) {
													case "Tel.":
														_data.kontakt.push({
															"type": "phone",
															"name": "Wahlkreis",
															"address": _line.replace(/[^0-9]/g,'').replace(/^0/,'+49')
														});
													break;
													case "Fax":
														_data.kontakt.push({
															"type": "fax",
															"name": "Wahlkreis",
															"address": _line.replace(/[^0-9]/g,'').replace(/^0/,'+49')
														});
													break;
													case "E-Mail":
														_data.kontakt.push({
															"type": "email",
															"name": "Wahlkreis",
															"address": $('a', _line).attr('href').replace(/^mailto:/g,'')
														});
													break;
												}
											} else {
												_addr.push(_line);
											}
										});
										_data.kontakt.push({
											"type": "address",
											"name": "Wahlkreis",
											"address": _addr.join(', ')
										});
									});
									
									/* social media */
									if (_data.name in sm_data) {
										sm_data[_data.name].forEach(function(sm){
											_data.web.push(sm);
										});
									}
									
									/* website */
									$('.RightPane_LinkListe_Items .small a', '#ctl00_RightPane_Holder').each(function(idx,e){
										if ($(this).text() === "Persönliche Homepage") {
											_data.web.push({
												"service": "website",
												"url": $(this).attr('href')
											});
										}
									});
									
									/* foto */
									$('.Abg_RightPane', '#ctl00_ContentPlaceHolder1_Wuc_AbgeordneteDetail1_divDetailHolder').each(function(idx,e){
										if ($('#ctl00_ContentPlaceHolder1_Wuc_AbgeordneteDetail1_hyp300dpi').length === 1) {
											_data.fotos.push({
												"url": url.resolve(_data.frak_url, $('#ctl00_ContentPlaceHolder1_Wuc_AbgeordneteDetail1_hyp300dpi').attr('href')),
												"copyright": $(this).find(".LicenseText").html().split('<br>').unshift(),
												"license": $(this).find(".LicenseText a").eq(0).attr('href')
											});
										}
									});
									
								}
								
								_count_fetched++;
								data.push(_data);
								if (_count_fetchable_sites === _count_fetched_sites && _count_fetchable === _count_fetched) _callback(null, data);
							
							});
							
						});
						
					});
				
				});
		
			}
	
		});
	
	});
	
};

var fetch_all = function(_callback) {
	var _passed = 0;
	var _data = {
		bt: null,
		wp: null,
		agw: null,
		frak_spd: null,
		frak_gruene: null,
		frak_linke: null,
		frak_cducsu: null
	};
	
	["bt","wp","agw","frak_spd","frak_gruene","frak_linke","frak_cducsu"].forEach(function(_fetch){
		if (argv.v) console.log('[init]'.magenta.inverse.bold, "scraper".cyan, _fetch.white);
		fetch[_fetch](function(err, data){
			_passed++;
			if (argv.v) console.log(((err)?'[fail]'.red:'[ ok ]'.green).inverse.bold, "scraper".cyan, _fetch.white);
			if (!err) _data[_fetch] = data;
			if (_passed === 8) _callback(null, _data);
		});
	});
};

var name_simplify = function(_name) {
	return _name
		.replace(/(Prof\. |Dr\. |h\.\s?c\. |med\. |vet\. )/g,'')
		.replace(/\s+[A-Za-z]\.\s+/,' ')
		.replace(/\s+/g,' ')
		.replace(/ [a-z]+ /g,' ')
		.replace(/ [a-z]+ /g,' ')
		.replace(/ Freiherr /g,' ')
		.replace(/-/g,' ')
		.replace(/^\s+|\s+$/g,'');
}

var array_intersect = function(a, b) {
	for (var i = 0; i < a.length; i++) {
		if (b.indexOf(a[i]) >= 0) return true;
	}
	return false;
}

var data_combine = function(_data, _callback){
	var data = [];
	_data.bt.forEach(function(d){
		var _item = {
			data: {},
			compare: {
				name: [],
				kontakt: []
			}
		};
		_item.data.bt = d;
		d.aliases.forEach(function(i){
			_item.compare.name.push(i)
			_item.compare.name.push(name_simplify(i))
		});
		d.kontakt.forEach(function(i){
			if (["phone","email"].indexOf(i.type) >= 0) _item.compare.kontakt.push(i.address);
		});
		data.push(_item);
	});
	
	/* find abgeordnetenwatch */
	for (var i = 0; i < _data.agw.length; i++) {
		var _found = false;
		var _name = name_simplify(_data.agw[i].name)
		for (var j = 0; j < data.length; j++) {
			if ((data[j].compare.name.indexOf(_name) >= 0) || (data[j].compare.name.indexOf(name_translations[_name]) >= 0)) {
				var _found = true;
				data[j].data.agw = _data.agw[i];
				break;
			}
		}
		if (!_found && argv.v) console.log("[warn]".inverse.bold.yellow, "Not found:".yellow, _name.white, '(Abgeordnetenwatch)'.cyan);
	}

	/* find wikipedia */
	for (var i = 0; i < _data.wp.length; i++) {
		var _found = false;
		for (var j = 0; j < data.length; j++) {
			if ((data[j].compare.name.indexOf(_data.wp[i].name) >= 0) || (data[j].compare.name.indexOf(name_translations[_data.wp[i].name]) >= 0)) {
				var _found = true;
				data[j].data.wp = _data.wp[i];
				break;
			}
		}
		if (!_found && argv.v) console.log("[warn]".inverse.bold.yellow, "Not found:".yellow, _data.wp[i].name.white, '(Wikipedia)'.cyan);
	}
	
	/* find spd */
	for (var i = 0; i < _data.frak_spd.length; i++) {
		var _name = name_simplify(_data.frak_spd[i].name)
		var _found = false;
		var _kontakt = [];
		_data.frak_spd[i].kontakt.forEach(function(_k){
			if (["phone","email"].indexOf(_k.type) >= 0) _kontakt.push(_k.address)
		});
		for (var j = 0; j < data.length; j++) {
			if ((data[j].compare.name.indexOf(_name) >= 0) || (data[j].compare.name.indexOf(name_translations[_name]) >= 0) || (array_intersect(_kontakt, data[j].compare.kontakt))) {
				var _found = true;
				data[j].data.frak_spd = _data.frak_spd[i];
				break;
			}
		}
		if (!_found && argv.v) console.log("[warn]".inverse.bold.yellow, "Not found:".yellow, _name.white, '(Fraktion SPD)'.cyan);
	}

	/* find grüne */
	for (var i = 0; i < _data.frak_gruene.length; i++) {
		var _name = name_simplify(_data.frak_gruene[i].name)
		var _found = false;
		var _kontakt = [];
		_data.frak_gruene[i].kontakt.forEach(function(_k){
			if (["phone","email"].indexOf(_k.type) >= 0) _kontakt.push(_k.address)
		});
		for (var j = 0; j < data.length; j++) {
			if ((data[j].compare.name.indexOf(_name) >= 0) || (data[j].compare.name.indexOf(name_translations[_name]) >= 0) || (array_intersect(_kontakt, data[j].compare.kontakt))) {
				var _found = true;
				data[j].data.frak_gruene = _data.frak_gruene[i];
				break;
			}
		}
		if (!_found && argv.v) console.log("[warn]".inverse.bold.yellow, "Not found:".yellow, _name.white, '(Fraktion Grüne)'.cyan);
	}
	
	/* find linke */
	for (var i = 0; i < _data.frak_linke.length; i++) {
		var _name = name_simplify(_data.frak_linke[i].name)
		var _found = false;
		var _kontakt = [];
		_data.frak_linke[i].kontakt.forEach(function(_k){
			if (["phone","email"].indexOf(_k.type) >= 0) _kontakt.push(_k.address)
		});
		for (var j = 0; j < data.length; j++) {
			if ((data[j].compare.name.indexOf(_name) >= 0) || (data[j].compare.name.indexOf(name_translations[_name]) >= 0) || (array_intersect(_kontakt, data[j].compare.kontakt))) {
				var _found = true;
				data[j].data.frak_linke = _data.frak_linke[i];
				break;
			}
		}
		if (!_found && argv.v) console.log("[warn]".inverse.bold.yellow, "Not found:".yellow, _name.white, '(Fraktion Linke)'.cyan);
	}

	/* find cdu/csu */
	for (var i = 0; i < _data.frak_cducsu.length; i++) {
		var _name = name_simplify(_data.frak_cducsu[i].name)
		var _found = false;
		var _kontakt = [];
		_data.frak_cducsu[i].kontakt.forEach(function(_k){
			if (["phone","email"].indexOf(_k.type) >= 0) _kontakt.push(_k.address)
		});
		for (var j = 0; j < data.length; j++) {
			if ((data[j].compare.name.indexOf(_name) >= 0) || (data[j].compare.name.indexOf(name_translations[_name]) >= 0) || (array_intersect(_kontakt, data[j].compare.kontakt))) {
				var _found = true;
				data[j].data.frak_cducsu = _data.frak_cducsu[i];
				break;
			}
		}
		if (!_found && argv.v) console.log("[warn]".inverse.bold.yellow, "Not found:".yellow, _name.white, '(Fraktion CDU/CSU)'.cyan);
	}

	_callback(null, data);

};

var data_unify = function(_data, _callback){

	var data = [];
	
	_data.forEach(function(item){
		
		var _data = {
			name: item.data.bt.name,
			fraktion: item.data.bt.fraktion,
			ausschuesse: item.data.bt.ausschuesse,
			aliases: item.data.bt.aliases,
			fotos: item.data.bt.fotos,
			kontakt: item.data.bt.kontakt,
			web: item.data.bt.web,
			wahl: {
				wahlkreis_id: null,
				wahlkreis_name: null,
				bundesland: null,
				mandat: item.data.bt.mandat,
				liste: null,
				listenplatz: null,
				ergebnis: null
			},
			meta: {
				beruf: null,
				wohnort: null,
				geburtsdatum: null,
				geburtsort: null,
				geschlecht: 'u',
				btcert: {
					uid: item.data.bt.btcertuid,
					vorname: item.data.bt.vorname,
					nachname: item.data.bt.nachname 
				}
			}
		};
		
		/* wahlkreis */
		if (item.data.bt.wahlkreis) {
			var _wahlkreis = item.data.bt.wahlkreis.match(/^Wahlkreis ([0-9]+): (.*)$/);
			if (_wahlkreis) {
				_data.wahl.wahlkreis_id = _wahlkreis[1];
				_data.wahl.wahlkreis_name = _wahlkreis[2];
			}
		}
		
		/* url */
		_data.web.push({
			service: "bundestag",
			url: item.data.bt.url
		});
		
		/* abgeordnetenwatch */
		
		/* name */
		if (_data.aliases.indexOf(item.data.agw.name) < 0) _data.aliases.push(item.data.agw.name);
		
		/* url */
		_data.web.push({
			service: "agw",
			url: item.data.agw.agw_url
		});
		
		/* fotos */
		item.data.agw.fotos.forEach(function(foto){
			_data.fotos.push(foto);
		});
		
		/* wahl */
		if ("liste" in item.data.agw && item.data.agw.liste !== null) _data.wahl.liste = item.data.agw.liste;
		if ("listenplatz" in item.data.agw && item.data.agw.listenplatz !== null) _data.wahl.listenplatz = item.data.agw.listenplatz;
		if ("wahlergebnis" in item.data.agw && item.data.agw.wahlergebnis !== null) _data.wahl.ergebnis = item.data.agw.wahlergebnis;

		/* meta */
		if ("geburtsdatum" in item.data.agw && item.data.agw.geburtsdatum !== null && item.data.agw.geburtsdatum.match(/^(0[1-9]|[1-2][0-9]|30|31)\.(0[1-9]|10|11|12)\.(19|20)[0-9]{2}$/)) _data.meta.geburtsdatum = moment(item.data.agw.geburtsdatum, "DD.MM.YYYY").format("YYYY-MM-DD");
		if ("beruf" in item.data.agw && item.data.agw.beruf !== null) _data.meta.beruf = item.data.agw.beruf;
		if ("wohnort" in item.data.agw && item.data.agw.wohnort !== null) _data.meta.wohnort = item.data.agw.wohnort;

		/* wikipedia */
		if ("wp" in item.data) {

			/* name */
			if (_data.aliases.indexOf(item.data.wp.name) < 0) _data.aliases.push(item.data.wp.name);

			/* fotos */
			item.data.wp.fotos.forEach(function(foto){
				_data.fotos.push(foto);
			});

			/* url */
			_data.web.push({
				service: "wikipedia",
				url: item.data.wp.wp_url
			});
		
			/* links */
			item.data.wp.links.forEach(function(link){
				var _url = url.parse(link.url);
				if ("hostname" in _url) {
					if (link.url.match(/^http:\/\/(www\.)?bundestag\.de\/bundestag\/abgeordnete17\/biografien\//)) {
						_data.web.push({
							service: "bundestag",
							url: link.url
						});
					} else if (link.url.match(/^http:\/\/(www\.)?abgeordnetenwatch\.de\/([a-zA-Z0-9\_]+)-575-([0-9]+).html$/)) {
						_data.web.push({
							service: "agw",
							url: link.url
						});
					} else {
						// FIXME: fraktionen, xing, twitter, facebook, meinvz, dnb
						_data.web.push({
							service: "unknown",
							title: link.text,
							url: link.url
						});
					}
				
				}
			});
			
			/* geschlecht */
			if (typeof item.data.wp.gender !== "undefined") {
				_data.meta.geschlecht = item.data.wp.gender;
			}
			
			if (_data.meta.geburtsort === null && item.data.wp.geburtsort !== null) {
				_data.meta.geburtsort = item.data.wp.geburtsort;
			}

			if (_data.meta.geburtsdatum === null && item.data.wp.geburtsdatum !== null) {
				_data.meta.geburtsdatum = moment(item.data.wp.geburtsdatum, 'D. MMMM YYYY').format("YYYY-MM-DD");
			}

			if (_data.wahl.bundesland === null && item.data.wp.bundesland !== null) {
				_data.wahl.bundesland = item.data.wp.bundesland;
			}
		
		} else {
			if (argv.v) console.log("[warn]".inverse.bold.yellow, "No Data for:".yellow, _data.name.white, '(Wikipedia)'.cyan);
		}

		/* spd */
		if ("frak_spd" in item.data) {
			
			/* name */
			if (_data.aliases.indexOf(item.data.frak_spd.name) < 0) _data.aliases.push(item.data.frak_spd.name);

			/* url */
			_data.web.push({
				service: "fraktion",
				url: item.data.frak_spd.frak_url
			});

			/* fotos */
			item.data.frak_spd.fotos.forEach(function(foto){
				_data.fotos.push(foto);
			});

			/* kontakt */
			item.data.frak_spd.kontakt.forEach(function(kontakt){
				_data.kontakt.push(kontakt);
			});
			
			/* web */
			item.data.frak_spd.web.forEach(function(web){
				_data.web.push(web);
			});
			
			/* beruf */
			if (_data.meta.beruf === null && item.data.frak_spd.beruf !== null) {
				_data.meta.beruf = item.data.frak_spd.beruf;
			} 

			if (_data.wahl.liste === null || _data.wahl.liste === "&uuml;ber Liste eingezogen") {
				_data.wahl.liste = item.data.frak_spd.liste;
			} else {
				if (_data.wahl.liste !== item.data.frak_spd.liste) {
					if (argv.v) console.log("[warn]".inverse.bold.yellow, "List mismatch:".yellow, _data.wahl.liste.white, "<>".red, item.data.frak_spd.liste.white, _data.name.cyan, '(Fraktion SPD)'.cyan);
				}
			}
			
			if (item.data.frak_spd.wahlkreis !== ' - ' && _data.wahl.wahlkreis_id === null) {
				// This does not happen, so if it does, add code here
				console.log("FIXME: SPD Wahlkreis Code");
				process.exit();
			}
			
		}
		
		/* gruene */
		if ("frak_gruene" in item.data) {
						
			/* name */
			if (_data.aliases.indexOf(item.data.frak_gruene.name) < 0) _data.aliases.push(item.data.frak_gruene.name);

			/* url */
			_data.web.push({
				service: "fraktion",
				url: item.data.frak_gruene.frak_url
			});

			/* fotos */
			item.data.frak_gruene.fotos.forEach(function(foto){
				_data.fotos.push(foto);
			});

			/* kontakt */
			item.data.frak_gruene.kontakt.forEach(function(kontakt){
				_data.kontakt.push(kontakt);
			});
			
			/* web */
			item.data.frak_gruene.web.forEach(function(web){
				_data.web.push(web);
			});
			
			/* wahlkreis */
			if (item.data.frak_gruene.wahlkreis !== undefined && _data.wahl.wahlkreis_id === null) {
				var _wahlkreis = item.data.frak_gruene.wahlkreis.match(/^Wahlkreis ([0-9]+): (.*)$/);
				if (_wahlkreis) {
					_data.wahl.wahlkreis_id = _wahlkreis[1];
					_data.wahl.wahlkreis_name = _wahlkreis[2];
				}
			}
			
		}

		/* linke */
		if ("frak_linke" in item.data) {

			/* name */
			if (_data.aliases.indexOf(item.data.frak_linke.name) < 0) _data.aliases.push(item.data.frak_linke.name);

			/* url */
			_data.web.push({
				service: "fraktion",
				url: item.data.frak_linke.frak_url
			});

			/* fotos */
			item.data.frak_linke.fotos.forEach(function(foto){
				_data.fotos.push(foto);
			});

			/* kontakt */
			item.data.frak_linke.kontakt.forEach(function(kontakt){
				_data.kontakt.push(kontakt);
			});

			/* web */
			item.data.frak_linke.web.forEach(function(web){
				_data.web.push(web);
			});

		}
		
		/* cducsu */
		if ("frak_cducsu" in item.data) {
			
			/* name */
			if (_data.aliases.indexOf(item.data.frak_cducsu.name) < 0) _data.aliases.push(item.data.frak_cducsu.name);

			/* url */
			_data.web.push({
				service: "fraktion",
				url: item.data.frak_cducsu.frak_url
			});

			/* fotos */
			item.data.frak_cducsu.fotos.forEach(function(foto){
				_data.fotos.push(foto);
			});

			/* kontakt */
			item.data.frak_cducsu.kontakt.forEach(function(kontakt){
				_data.kontakt.push(kontakt);
			});

			/* web */
			item.data.frak_cducsu.web.forEach(function(web){
				_data.web.push(web);
			});

			/* beruf */
			if (_data.meta.beruf === null && item.data.frak_cducsu.beruf !== null) {
				_data.meta.beruf = item.data.frak_cducsu.beruf;
			} 

			/* mandat */
			if (_data.wahl.mandat === null && item.data.frak_cducsu.mandat !== null) {
				_data.wahl.mandat = item.data.frak_cducsu.mandat;
			} 

			/* wahlkreis */
			if (("wahlkreis" in item.data.frak_cducsu) && _data.wahl.wahlkreis_id === null) {
				_data.wahl.wahlkreis_id = item.data.frak_cducsu.wahlkreis;
			}
			
			/* geburtsdatum */
			if (_data.meta.geburtsdatum === null && "geburtsdatum" in item.data.frak_cducsu && item.data.frak_cducsu.geburtsdatum !== null) {
				_data.meta.geburtsdatum = moment(item.data.frak_cducsu.geburtsdatum, "DD.MM.YYYY").format("YYYY-MM-DD");
			}
			
			/* geburtsort */
			if (_data.meta.geburtsort === null && "geburtsort" in item.data.frak_cducsu && item.data.frak_cducsu.geburtsort !== null) {
				_data.meta.geburtsort = item.data.frak_cducsu.geburtsort;
			}
			
		}
		
		data.push(_data);
		
	});
	
	_callback(null, data);
	
};

var load_data = function(_callback) {
	var cache_file = path.resolve(__dirname, 'cache.json');
	if (argv.c && fs.existsSync(cache_file)) {
		_callback(null, JSON.parse(fs.readFileSync(cache_file)))
	} else {
		fetch_all(function(err, data){
			fs.writeFileSync(cache_file, JSON.stringify(data, null, '\t'));
			_callback(null, data);
		});
	}
}

var main = function(){
	var out_file = (argv._.length > 0) ?  path.resolve(argv._[0]) : path.resolve(__dirname, 'data.json');
	load_data(function(err, data){
		if (argv.v) console.log('[stat]'.magenta.inverse.bold, "all data loaded".white);
		data_combine(data, function(err, data){
			data_unify(data, function(err, data){
				if (argv.v) console.log('[stat]'.magenta.inverse.bold, "all data combined".white);
				fs.writeFileSync(out_file, JSON.stringify(data, null, '\t'));
				console.log("<3".bold.magenta, 'made with datalove'.magenta);
			});
		});
	});
};

/* execute */
main();
