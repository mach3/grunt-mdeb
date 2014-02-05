/**
 * Publisher
 * ---------
 */

var fs = require("fs"),
    path = require("path"),
    cp = require("child_process"),
    url = require("url"),
    markdown = require("markdown").markdown,
    cheerio = require("cheerio"),
    beautify = require("js-beautify"),
    _ = require("underscore"),
    u = require("./utils");


var Publisher = {

    grunt: null,

    // defaults for options
    defaults: {
        srcPath: "src",
        buildPath: "build",
        tempPath: "tmp",
        templatePath: path.join(__dirname, "../template"),
        contentPath: "OEBPS",
        dataPath: "data",
        assetsPath: "assets",
        rebuild: "rebuild",
        validate: false,
        validateCommand: null,
        verbose: true,

        data: {
            meta: {
                name: "document",
                title: "",
                author: "",
                publisher: "",
                description: "",
                modified: null,
                language: "en",
                identifier: "",
                navTitle: "Table of Contents",
                direction: "default",
                layout: "reflowable",
                orientation: "auto",
                spread: "auto"
            },
            assets: {
                commonStyle: null,
                navStyle: null,
                pageStyle: null,
                coverStyle: null,
                coverImage: null
            },
            items: []
        }
    },

    // options
    options: {},

    // mimetype pairs
    types: {
        "txt": "text/plain",
        "css": "text/css",
        "js": "text/javascript",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "png": "image/png",
        "svg": "image/svg+xml",
        "xhtml": "application/xhtml+xml",
        "ncx": "application/x-dtbncx+xml"
    },

    // document data
    content: [],
    index: [],

    // data for content.opf
    assets: [],
    guide: [],
    spine: []
};

/**
 * Initialize
 */
Publisher.init = function(grunt){
    this.grunt = grunt;
};

/**
 * Configure options by object
 */
Publisher.config = function(options){
    u.merge(this.options, this.defaults, options);

    // format date
    this.options.data.meta.modified = (function(modified){
        var date = modified ? new Date(modified) : new Date();
        return date.toISOString().replace(/\.[0-9]+/, "");
    }(this.options.data.meta.modified));
};

/**
 * Get value from options by key
 */
Publisher.get = function(key){
    return this.options[key];
};

/**
 * Get mime-type by extention of file name string
 */
Publisher.type = function(name){
    var ext = name.replace(/^.+\./, "");
    return this.types[ext] || "application/unknown";
};

/**
 * Generate path from the key of attributes
 * String "Path" is needless as appended in function
 */
Publisher.resolve = function(){
    var paths = [], my = this;
    Array.prototype.slice.call(arguments).forEach(function(name){
        var path = my.get(name + "Path");
        paths.push(path || name);
    });
    return path.join.apply(path, paths);
};

/**
 * Get id value by path string
 */
Publisher.getId = function(str, prefix){
    return prefix + "-" + str.replace(/\//g, "-").replace(/[^a-zA-Z0-9\-_\.]/, "");
};

/**
 * Flush log or error
 */
Publisher.log = function(message, e){
    if(! this.get("verbose")){ return; }
    e = (e === void 0) ? false : e;
    if(! this.grunt){
        return console[e ? "error" : "write"](message);
    }
    this.grunt.log[e ? "error" : "writeln"](message);
};

/**
 * Build Methods
 * -------------
 */

/**
 * Clean build directory
 */
Publisher.clean = function(){
    var df = u.deferred();
    this.log("> Cleaning dist directory");
    u.execChain([
        u.sprintf("-mkdir %s", this.resolve("build")),
        u.sprintf("-mkdir %s", this.resolve("build", "temp")),
        u.sprintf("-rm %s/*.epub", this.resolve("build")),
        u.sprintf("-rm -r %s", this.resolve("build", "temp")),
        u.sprintf("-rm %s", this.resolve("build", this.get("rebuild"))),
        u.sprintf("cp -r %s %s", this.resolve("template", "epub"), this.resolve("build", "temp")),
        u.sprintf("find %s -name 'template-*' | xargs rm", this.resolve("build", "temp")),
        u.sprintf("-cp -r %s/assets %s/assets", this.resolve("src"), this.resolve("build", "temp", "content"))
    ], function(){
        df.resolve();
    });
    return df;
};

/**
 * Publish the content
 * - generate content
 * - generate navigation
 * - generate manifest
 */
Publisher.publish = function(){
    this.log("> Generate contents");
    this.genContent();
    this.genNavi();
    this.genAssetsListData();
    this.genManifest();
    this.genCommand();
};

/**
 * Build *.epub file
 */
Publisher.build = function(){
    var df, meta;

    this.log("> Generate EPUB file");
    df = u.deferred();
    meta = this.get("data").meta;

    u.execChain([
        u.sprintf(
            [
                "cd %s"
                + "&& zip -0 -X ../%s.epub mimetype"
                + "&& zip -r ../%s.epub ./* -x mimetype"
            ].join(" "),
            this.resolve("build", "temp"),
            meta.name,
            meta.name
        )
    ], function(){
        df.resolve();
    });
    return df;
};

/**
 * Validate
 */
Publisher.validate = function(){
    var my = this, df = u.deferred(), cmd, file;
    cmd = this.get("validateCommand");
    if(!! cmd && this.get("validate")){
        this.log("> Validate EPUB file\n");
        file = this.resolve("build", this.get("data").meta.name + ".epub");
        cp.exec(u.sprintf(cmd, file), function(e, out, error){
            my.log(out);
            if(e){ my.log(error, e); }
            df.resolve();
        });
    }
    return df;
};

/**
 * Generate Methods
 * ----------------
 */

/**
 * Parse markdown to HTML
 * - unescape [html][/html] block
 */
Publisher.toHTML = function(content){
    var html = [], flagPattern = "%%=html_%s %%", index = 0;
    // preserve HTML
    content = content.replace(/\{\{html\}\}([\s\S]+?)\{\{\/html\}\}/g, function(a, value){
        var flag = u.sprintf(flagPattern, index++);
        html.push({
            flag: flag,
            html: value
        });
        return flag;
    });
    content = markdown.toHTML(content);
    // replace html
    html.forEach(function(o){
        var reg = new RegExp(u.sprintf("(<p>[\\s]*?)?%s([\\s]*?<\\/p>)?", o.flag));
        content = content.replace(reg, o.html);
    });
    return content;
};

/**
 * If the url referes local markdown file,
 * replace the name as xhtml
 */
Publisher.replacePageLink = function(href){
    var ext = /\.(md|markdown)$/,
        o = url.parse(href);
    if(! o.protocol && ext.test(o.path)){
        return o.path.replace(ext, ".xhtml") + (o.hash || "");
    }
    return href;
};

/**
 * Generate content document
 * - Load markdown document and convert to HTML
 * - Output as xhtml file and generate TOC data
 */
Publisher.genContent = function(){
    this.log("> Generate content documents");

    var my = this, paths, tmpl, headlines, chapter, meta, assets;

    paths = {
        src: this.resolve("src") + "/",
        build: this.resolve("build", "temp", "content") + "/"
    };
    tmpl = {
        cover: _.template(u.readFile(
            this.resolve("template", "epub", "content", "data", "template-cover.xhtml")
        )),
        page: _.template(u.readFile(
            this.resolve("template", "epub", "content", "data", "template-document.xhtml")
        ))
    };
    headlines = ["h1", "h2", "h3", "h4", "h5"];
    chapter = 0;
    meta = this.get("data").meta;
    assets = this.get("data").assets;

    // get chapter files
    this.get("data").items.forEach(function(values, i){
        var file, props, content, $, name, id, item, section = 0;

        values = values.split("@");
        file = values.shift();
        props = values.length ? values[0].split(",").join(" ") : null;
        content = my.toHTML(u.readFile(paths.src + file));
        $ = cheerio.load(content, {xmlMode: true});
        name = file.replace(/\.md$/, ".xhtml");
        id = my.getId(name, "item");

        if(! i){
            // first item is cover page
            item = {
                id: id,
                title: meta.title,
                type: my.types.xhtml,
                href: name,
                content: content,
                assets: assets,
                meta: meta
            };

            // generate document
            u.writeFile(paths.build + name, tmpl.cover(item));

            // Add cover entry to guide
            my.guide.push({
                type: "cover",
                title: "Cover Page",
                href: item.href
            });
        } else {
            chapter ++;
            item = {
                id: id,
                title: $("h1").text(),
                type: my.types.xhtml,
                build: paths.build + name,
                href: name,
                assets: assets,
                meta: meta
            };

            // add flag to headlines and generate index tree
            $(headlines.join(",")).each(function(i, node){
                var level, flag, o;
                level = headlines.indexOf(node.name);
                flag = u.sprintf("nav-%s-%s", chapter, ++section);
                this.attr("id", flag);
                o = {
                    chapter: chapter,
                    section: section,
                    level: level,
                    label: this.text(),
                    path: item.href + "#" + flag
                };
                o.src = o.path.replace(my.resolve("data") + "/", "");
                my.index.push(o);
            });

            // replace links
            $("a").each(function(){
                this.attr("href", my.replacePageLink(this.attr("href")));
            });

            // clean HTML and generate document
            item.content = $.html().replace(/<br>/g, "<br />");
            u.writeFile(item.build, tmpl.page(item));

            // first text content ? then add to guide
            if(i===1){
                my.guide.push({
                    type: "text",
                    title: "Start Page",
                    href: item.href
                });
            }

            my.log(u.sprintf("> - %s added", item.build));
        }

        // add to prop
        my.content.push(item);
        my.spine.push({
            id: id,
            props: props,
            linear: !! i
        });
    });
};

/**
 * Generate navigation document
 * - Generate tree and output as nav.xhtml, toc.ncx
 */
Publisher.genNavi = function(){
    var $, o, depth, meta, assets;

    this.log(u.sprintf("> Generate navigation: %s entries", this.index.length));
    $ = cheerio.load("<body />");
    $("body").append('<nav><ol></ol></nav><navMap></navMap>');
    o = {
        nav: {
            id: "nav.xhtml",
            render: _.template(
                '<li class="level-<%=level %>">'
                + '<a href="<%=src %>" target="content"><%=label %></a>'
                + '<ol></ol>'
                + '</li>'
            )
        },
        ncx: {
            id: "toc.ncx",
            render: _.template(
                '<navPoint class="level-<%=level %>" id="navPoint-<%=id %>" playOrder="<%=id %>">'
                + '<navLabel><text><%=label %></text></navLabel>'
                + '<content src="<%=path %>" />'
                + '</navPoint>'
            )
        }
    };
    depth = 0;
    meta = this.get("data").meta;
    assets = this.get("data").assets;

    // generate DOM for toc.ncx and nav.xhtml
    this.index.forEach(function(item, i){
        var html, level = item.level - 1, vars;
        depth = item.level >= depth ? item.level + 1 : depth;
        vars = _.extend({id: i + 1}, item);
        html = {
            nav: o.nav.render(vars),
            ncx: o.ncx.render(vars)
        };
        if(! item.level){
            $("nav > ol").append(html.nav);
            $("navMap").append(html.ncx);
            return;
        }
        $(".level-" + level + " > ol", "nav").last().append(html.nav);
        $(".level-" + level, "navMap").last().append(html.ncx);
    });

    // generate nav.xhtml
    // - clean XML 
    $("nav ol").filter(function(){
        return ! this.find("li").length;
    }).remove();
    // - flush
    u.writeFile(
        this.resolve("build", "temp", "content", "data", o.nav.id),
        beautify.html(
            _.template(
                u.readFile(this.resolve("template", "epub", "content", "data", "template-" + o.nav.id)),
                {
                    nav: $("nav").html(),
                    navTitle: meta.navTitle,
                    assets: assets,
                    language: meta.language
                }
            )
        )
    );

    // generate toc.ncx
    // - clean XML
    $("navMap navPoint").attr("class", null);
    o.ncx.html = $("navMap").html().replace(/(<\/?nav)(\w+)/g, function(a, b, c){
        return b + u.capitalize(c);
    }).replace(/(\s)playorder=/g, function(a, b){
        return b + "playOrder=";
    });
    // - flush
    u.writeFile(
        this.resolve("build", "temp", "content", o.ncx.id),
        beautify.html(
            _.template(
                u.readFile(this.resolve("template", "epub", "content", "template-" + o.ncx.id)),
                {
                    navMap: o.ncx.html,
                    meta: meta,
                    assets: assets,
                    depth: depth
                }
            )
        )
    );

    // add entries to assets
    this.assets.push({
        id: o.nav.id,
        prop: "nav",
        href: this.resolve("data", o.nav.id),
        type: this.type("xhtml")
    });
    this.assets.push({
        id: "ncx",
        href: o.ncx.id,
        type: this.type("ncx")
    });

    // add nav.xhtml to spine as second
    this.spine = this.spine.slice(0, 1)
    .concat([{id: o.nav.id}])
    .concat(this.spine.slice(1));

    // add nav.xhtml to guide
    this.guide.push({
        type: "toc",
        title: "Table of Contents",
        href: this.resolve("data", o.nav.id)
    });
};

/**
 * Generate assets list data
 * - Add cover image entry
 * - Recursively search files in assets directory, add them as entry
 */
Publisher.genAssetsListData = function(){
    var root, read, my = this;

    // add cover image entry
    (function(src){
        if(! src){ return; }
        var id = my.getId(src, "asset");
        my.assets.push({
            id: id,
            prop: "cover-image",
            href: src,
            type: my.type(id)
        });
    }(this.get("data").assets.coverImage));

    // find files in asset dir
    root = this.resolve("src", "assets") + "/";
    read = function(dir){
        var files = fs.readdirSync(dir);
        files.forEach(function(name){
            var f, stat, href;
            f = path.normalize([dir, name].join("/"));
            stat = fs.statSync(f);
            if(/^\./.test(name)){ return; }
            if(stat.isDirectory()){
                return read(f);
            }
            href = my.resolve("assets", f.replace(root, ""));
            my.assets.push({
                id: my.getId(href, "asset"),
                type: my.type(name),
                href: href
            });
        });
    };
    read(root);

    this.log(u.sprintf("> Generate assets list: %s entries", this.assets.length));
};

/**
 * Generate manifest file (content.opf)
 */
Publisher.genManifest = function(){
    var vars, render;
    this.log("> Generate manifest");
    vars = _.extend({
        manifest: this.assets.concat(this.content),
        spine: this.spine,
        guide: this.guide
    }, this.get("data").meta);
    render = _.template(u.readFile(
        this.resolve("template", "epub", "content", "template-content.opf")
    ));
    u.writeFile(
        this.resolve("build", "temp", "content", "content.opf"),
        beautify.html(render(vars).replace(/\n|\r/g, ""))
    );
};

/**
 * Generate re-build command script
 */
Publisher.genCommand = function(){
    var name, render, file;
    name = this.get("rebuild");
    render = _.template(u.readFile(this.resolve("template", "shell", "template-" + name)));
    file = this.resolve("build", name);
    u.writeFile(file, render(this.options));
    fs.chmodSync(file, "0755");
};

module.exports = Publisher;