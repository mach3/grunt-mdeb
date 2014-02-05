
# grunt-mdeb

Grunt task to publish markdown docs as EPUB 3.0 book.


## Features

- Compile markdown files to EPUB data.
- Automatically generate indexes and output as navigation documents.

## Example

### Install

	$ npm install grunt-mdeb

### Files and Directories

	/
	├ dest/
	├ src/
	│ ├ assets/
	│ │ ├ img/
	│ │ └ css/
	│ ├ data/
	│ │ ├ cover.md
	│ │ ├ 01.md
	│ │ ├ 02.md
	│ │ ├ 03.md
	│ │ └ ...
	│ └ publish.json
	└ Gruntfile.js

### Configure "publish.json"

	{
		"meta": {
			"name": "document",
			"title": "My First Book",
			"author": "mach3",
			"publisher": "matsukaze.",
			"description": "This is my first book",
			"language": "en",
			"identifier": "http://example.com/books/my-first-book",
			"navTitle": "Table of Contents"
		},
		"assets": {
			"commonStyle": "assets/css/common.css",
			"navStyle": "assets/css/nav.css",
			"pageStyle": "assets/css/page.css",
			"coverStyle": "assets/css/cover.css",
			"coverImage": "assets/img/cover.png"
		},
		"items": [
			"data/cover.md",
			"data/01.md",
			"data/02.md",
			"data/03.md",
			...
		]
	}

More options are available. Read [document.epub](demo/dest/document.epub) (Japanese).

### Configure Task

	grunt.loadNpmTasks("grunt-mdeb");
	grunt.initConfig({
		mdeb: {
			dest: {
				src: "src",
				dest: "dest"
			}
		}
	});

### And Go

	$ grunt mdeb


## Document and Demo

- [Demo Project](demo/)
- [More Information (document.epub, Japanese)](demo/dest/document.epub)


## License

The MIT License

## Author

mach3 <http://github.com/mach3>

