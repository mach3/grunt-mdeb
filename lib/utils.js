/**
 * Utility Functions for publisher.js
 * ----------------------------------
 */
 
var fs = require("fs"),
    cp = require("child_process"),
    api = {};

/**
 * Return formatted string
 * @param String format
 * @param String str (multiple)
 * @return String
 */
api.sprintf = function(/* format, str, str */){
    var args = Array.prototype.slice.call(arguments);
    return args.shift().replace(/%s/g, function(){
        return args.shift() || "";
    });
};

/**
 * Return type name of the object
 * @param Mixed obj
 * @return String
 */
api.typeof = function(obj){ 
    var m = Object.prototype.toString.call(obj).match(/\[object\s(\w+?)\]/);
    return m ? m[1].toLowerCase() : null;
};

/**
 * Deep copy objects
 * @param Object dest
 * @param Object src (multiple)
 * @return Object
 */
api.merge = function(){
    var i = 0, dest, end, extend;
    dest = arguments[i++];
    extend = function(dest, src){
        var name;
        for(name in src){
            if(! src.hasOwnProperty(name)){ continue; }
            if(api.typeof(src[name]) === "object"){
                dest[name] = api.merge(dest[name] || {}, src[name]);
                continue;
            }
            dest[name] = src[name];
        }
        return dest;
    };
    for(end = arguments.length; i<end; i++){
        extend(dest, arguments[i]);
    }
    return dest;
};

/**
 * Read the file and return the content
 * @param String file
 * @param String enc (optional)
 * @return String
 */
api.readFile = function(file, enc){
    return fs.readFileSync(file, enc || "utf-8");
};

/**
 * Write content to the file
 * @param String file
 * @param String content
 */
api.writeFile = function(file, content){
    fs.writeFileSync(file, content);
};

/**
 * Call child process in order
 * @param Array commands
 * @param Function callback
 */
api.execChain = function(commands, callback){
    var forcePrefix, process, outputs = [], errors = 0;
    forcePrefix = /^\-/;
    if(! commands.length){
        return;
    }
    process = function(){
        var cmd, force;
        cmd = commands.shift();
        force = forcePrefix.test(cmd);
        cp.exec(cmd.replace(forcePrefix, ""), function(e, out, error){
            outputs.push(e ? error : out);
            errors += e ? 1 : 0;
            if((e && ! force) || ! commands.length){
                return callback(!! errors, outputs);
            }
            process();
        });
    };
    process();
};

/**
 * Return deferred object
 * @return Object
 */
api.deferred = function(){
    var my = {
        result: null,
        args: null,
        handlers: {
            fail: null,
            then: null,
            done: null
        },
        run: function(name){
            [name, "done"].forEach(function(type){
                var handler = my.handlers[type];
                if(api.typeof(handler) === "function"){
                    handler.apply(my, my.args);
                }
            });
        },
        _result: function(result, args){
            if(this.result !== null){ return; }
            this.result = result;
            this.args = args;
            this.run(result ? "then" : "fail", args);
        },
        resolve: function(){
            this._result(true, arguments);
        },
        reject: function(){
            this._result(false, arguments);
        },
        _hook: function(result, callback){
            var name = result === null ? "done"
            : result ? "then" : "fail";
            if(api.typeof(callback) !== "function"){
                return this;
            }
            this.handlers[name] = callback;
            if(this.result !== null){
                this.run(name);
            }
            return this;
        },
        then: function(callback){
            return this._hook(true, callback);
        },
        fail: function(callback){
            return this._hook(false, callback);
        },
        done: function(callback){
            return this._hook(null, callback);
        }

    };
    return my;
};

/**
 * Capitalize string
 * @param String str
 * @return String
 */
api.capitalize = function(str){
    return str.replace(/^[a-z]/, function(a){
        return a.toUpperCase();
    });
};

module.exports = api;
