# Bundesscraper

Scraping Data of Members of the German Federal Parliament.

## About

Bundesscraper collects data of German Parliament members from several Websites and combines them. The data is collected from

* [bundestag.de](http://www.bundestag.de/)
* [de.wikiepdia.org](http://de.wikiepdia.org/)
* [abgeordnetenwatch.de](http://www.abgeordnetenwatch.de/)
* [spdfraktion.de](http://www.spdfraktion.de/)
* [gruene-bundestag.de](http://www.gruene-bundestag.de/)
* [linksfraktion.de](http://www.linksfraktion.de/)
* [fdp-fraktion.de](http://www.fdp-fraktion.de/)
* [cducsu.de](http://www.cducsu.de/)

## Installation

````
npm -g install bundesscraper
````

## Usage

````
npm [-c] [-v] [-d] [data.json]
````

* `-c` `--cache` turn on caching, creates cache.json with unprocessed data
* `-v` `--verbose` show a lot of information
* `-d` `--debug` show a lot more information

## License

Bundesscraper is [Public Domain](./license.md).
