
module.exports = function(grunt){

	grunt.loadTasks("../tasks");

	grunt.initConfig({

		mdeb: {
			demo: {
				options: {
					validateCommand: "epubcheck %s",
					validate: true
				},
				src: "src",
				dest: "dest"
			}
		}

	});

	grunt.registerTask("default", []);

};