/**
 * Custom task: mdeb
 */
module.exports = function(grunt){
    var publisher = require("../lib/publisher.js"),
        u = require("../lib/utils");

    grunt.registerMultiTask("mdeb", "Publish epub data from markdown document", function(){
        var done = this.async(), config;

        // src and dest required
        if(! this.data.src || ! this.data.dest){
            grunt.log.error("Required data: 'src' or 'build' missing");
            return done();
        }

        // publish.json required
        config = grunt.file.readJSON(this.data.src + "/publish.json");
        if(! config){
            grunt.log.error("'publish.json' is missing or invalid");
            return done();
        }

        // initialize, configure
        publisher.init(grunt);
        publisher.config(
            u.merge(
                this.options(), 
                {
                    srcPath: this.data.src,
                    buildPath: this.data.dest,
                    data: config
                }
            )
        );

        // build
        publisher.clean().then(function(){
            publisher.publish();
            publisher.build().done(function(){
                publisher.validate().done(function(){
                    done();
                });
            });
        });
    });
};