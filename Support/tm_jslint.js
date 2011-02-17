/*jslint forin:true, regexp:false, white:false */
/*globals $, JSLINT, TextMate, setTimeout, window */

(function () {

var tm_jslint = {
    input: '',
    filePath: '',
    options: {},
    defaults: {},
    inlineOptions: {},
    checkboxes: {
        passfail:   'Stop on first error',
        white:      'Strict white space',
        browser:    'Assume a browser',
        devel:      'Assume <code>console</code>, <code>alert</code>, ...',
        widget:     'Assume a Yahoo Widget',
        windows:    'Assume Windows',
        rhino:      'Assume Rhino',
        safe:       'Safe Subset',
        adsafe:     'ADsafe',
        debug:      'Tolerate <code>debugger</code> statements',
        evil:       'Tolerate <code>eval</code>',
        forin:      'Tolerate unfiltered <code>for</code> <code>in</code>',
        sub:        'Tolerate inefficient subscripting',
        'continue': 'Tolerate <code>continue</code>',
        css:        'Tolerate CSS workarounds',
        cap:        'Tolerate <code>HTML</code> case',
        on:         'Tolerate <code>HTML</code> event handlers',
        fragment:   'Tolerate <code>HTML</code> fragments',
        es5:        'Tolerate ES5 syntax',
        onevar:     'Allow one <code>var</code> statement per function',
        undef:      'Disallow undefined variables',
        nomen:      'Disallow dangling <code>_</code> in identifiers',
        plusplus:   'Disallow <code>++</code> and <code>--</code>',
        bitwise:    'Disallow bitwise operators',
        regexp:     'Disallow insecure <code>.</code> and <code>[^</code>...<code>]</code> in /RegExp/',
        newcap:     'Require Initial Caps for constructors',
        strict:     'Require <code>"use strict";</code>'
    },

    init: function () {
        var div = $('<div>'),
            self = this;

        this.options = $.extend({}, this.defaults);
        this.input = this.input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        $.each(this.checkboxes, function (name, desc) {
            $('<label>', { title: name, html: desc, 'class': 'item-checkbox' })
                .prepend($('<input>', {
                    type: 'checkbox',
                    id: 'JSLINT_' + name.toUpperCase(),
                    title: name
                }))
                .appendTo(div);
        });

        this.filterBlockComments(false);

        $('<div class="item-text">')
            .append($('<label>Max Errors:</label>'))
            .append($('<input>', {
                    type: 'text',
                    value: this.options.maxerr,
                    id: 'JSLINT_MAXERR',
                    change: function () {
                        var elem = $(this);

                        self.options.maxerr = parseInt(elem.val(), 10);
                        self.updateLintString();
                    }
                })
            )
            .appendTo(div);

        $('<div class="item-text">')
            .append($('<label>Tab Size:</label>'))
            .append($('<input>', {
                    type: 'text',
                    value: this.options.indent,
                    id: 'JSLINT_INDENT',
                    change: function () {
                        var elem = $(this);

                        self.options.indent = parseInt(elem.val(), 10);
                        self.updateLintString();
                    }
                })
            )
            .appendTo(div);

        $('<div class="item-text">')
            .append($('<label>Predefined:</label>'))
            .append($('<input>', {
                    type: 'text',
                    value: this.getPredefGlobals(),
                    id: 'JSLINT_PREDEF_GLOBALS',
                    change: function () {
                        var elem = $(this);

                        self.options.predef = {};
                        elem.val().split(',').forEach(function (name, i) {
                            self.addPredefGlobal(name);
                        });
                        elem.val(self.getPredefGlobals());
                        self.updateLintString();
                    }
                })
            )
            .appendTo(div);

        $('<button>', {
            text: 'The Good Parts',
            click: function (e) {
                e.preventDefault();
                self.disableInlineOptions();

                $.extend(self.options, {
                    white:    true,
                    onevar:   true,
                    undef:    true,
                    nomen:    true,
                    plusplus: true,
                    bitwise:  true,
                    regexp:   true,
                    newcap:   true
                });

                self.runCheck();
            }
        }).appendTo(div);

        $('<button>', {
            text: 'Clear All',
            click: function (e) {
                e.preventDefault();
                self.disableInlineOptions();

                $.each(self.options, function (i, val) {
                    if (typeof val === 'boolean') {
                        self.options[i] = false;
                    }
                });

                self.runCheck();
            }
        }).appendTo(div);

        $('<button>', {
            text: 'Run Again',
            click: function (e) {
                e.preventDefault();
                self.disableInlineOptions();
                self.runCheck();
            }
        }).appendTo(div);

        div.prependTo('#JSLINT_OPTIONS');

        $('#JSLINT_JSLINTSTRING').bind({
            click: function (e) {
                $(this).select();
            }
        }).after($('<button>', {
            text: 'Copy to Clipboard',
            click: function (e) {
                var elem = $(this), cmd;

                e.preventDefault();
                cmd = TextMate.system('/usr/bin/pbcopy', function () {
                    elem.text('Done!');
                    setTimeout(function () { elem.text('Copy to Clipboard'); }, 1500);
                });
                cmd.write($('#JSLINT_JSLINTSTRING').val());
                cmd.close();
            }
        }));

        $('#JSLINT_OPTIONS').find(':checkbox').bind({
            click: function (e) {
                var elem = $(this);
                self.options[elem.attr('title')] = elem.is(':checked');
                self.disableInlineOptions();
                self.runCheck();
            }
        });
    },

    disableInlineOptions: function () {
        this.filterBlockComments(true);
    },

    setInlineOption: function (token) {
        token = token.split(':').map(function (str) {
            return str.trim().replace(/['"]/g, '');
        });

        if (2 !== token.length || !token[0].length) {
            return;
        }

        if (token[1] === 'true') {
            this.inlineOptions[token[0]] = true;
        } else if (token[1] === 'false') {
            this.inlineOptions[token[0]] = false;
        }
    },

    addPredefGlobal: function (token) {
        var name, readWrite = false;

        token = token.split(':').map(function (str) {
            return str.trim().replace(/['"]/g, '');
        });

        if (!(name = token[0])) {
            return;
        }

        readWrite = (2 === token.length && 'true' === token[1]);

        if (!this.options.predef) {
            this.options.predef = {};
        }

        this.options.predef[name] = readWrite;
    },

    getPredefGlobals: function () {
        var list = [],
            prop = false;

        for (prop in this.options.predef) {
            list.push(prop + (this.options.predef[prop] === true ? ':true' : ''));
        }

        return list.sort().join(', ');
    },

    updateLintString: function () {
        var lintString = '',
            lintOpts = [],
            globalsStr = '',
            self = this,
            o = $.extend({}, this.inlineOptions, this.options);

        $.each(o, function (name, value) {
            if (name in self.checkboxes) {
                if (!!value) {
                    $('#JSLINT_' + name.toUpperCase()).attr('checked', 'checked');
                } else {
                    $('#JSLINT_' + name.toUpperCase()).removeAttr('checked');
                }

                if (name in self.inlineOptions || value !== self.defaults[name]) {
                    lintOpts.push(name + ':' + (!!value ? 'true' : 'false'));
                }
            }
        });

        if (o.white && +o.indent && o.indent !== self.defaults.indent) {
            lintOpts.push('indent:' + o.indent);
        }

        if (+o.maxlen && o.maxlen !== self.defaults.maxlen) {
            lintOpts.push('maxlen:' + o.maxlen);
        }

        if (+o.maxerr && o.maxerr !== self.defaults.maxerr) {
            lintOpts.push('maxerr:' + o.maxerr);
        }

        lintString = '/*jslint ' + lintOpts.join(', ') + " */\n";

        globalsStr = this.getPredefGlobals();

        if (globalsStr.length) {
            lintString += '/*globals ' + globalsStr + " */\n";
        }

        $('#JSLINT_JSLINTSTRING').text(lintString);
    },

    /**
     * Crudely walk the source to work with jslint options embedded in the
     * input source code's comments.
     *
     * This avoids issues raised when simply using regular expressions, like
     * erroneously matching options strings embedded in string literals.
     */
    filterBlockComments: function (updateInput) {
        var filtered = '',
            input = this.input,
            len = input.length,
            pos = 0,
            end = 0,
            inQuotes = false,
            type = false,
            globals = [],
            options = [],
            ch = false,
            self = this;

        function peek() { return input.charAt(pos); }
        function next() {
            var ch = input.charAt(pos++);
            return (!ch ? false : ch);
        }

        for (;;) {
            if (pos < 0 || false === (ch = next())) {
                break;
            }

            // String literal; skip it
            if (ch === '"' || ch === "'") {
                filtered += inQuotes = ch;

                for (;;) {
                    if (false === (ch = next())) {
                        break;
                    }

                    filtered += ch;

                    if (ch === '\\' && peek()) {
                        filtered += next();
                    } else if (ch === inQuotes) {
                        break;
                    }
                }

                continue;
            // Single-line comment; skip to the next line
            } else if (ch === '/' && peek() === '/') {
                pos++;
                filtered += '//';

                if (-1 !== (end = input.indexOf("\n", pos))) {
                    end++;
                    filtered += input.substring(pos, end);
                    pos = end;
                }
                continue;
            // Jackpot
            } else if (ch === '/' && peek() === '*') {
                filtered += '/*';
                pos++;

                if ('jslint' === input.substr(pos, 6)) {
                    type = 'jslint';
                    filtered += '______';
                    pos += 6;
                } else if ('globals' === input.substr(pos, 7)) {
                    type = 'globals';
                    filtered += '_______';
                    pos += 7;
                } else {
                    type = false;
                }

                if (-1 !== (end = input.indexOf('*/', pos))) {
                    if (type === 'globals') {
                        globals.push(input.substring(pos, end).trim());
                    } else if (type === 'jslint') {
                        options.push(input.substring(pos, end).trim());
                    }
                    end += 2;
                    filtered += input.substring(pos, end);
                    pos = end;
                }
                continue;
            }

            filtered += ch;
        }

        if (updateInput) {
            this.input = filtered;
        } else {
            globals.join(',').split(',').forEach(function (val, i) {
                self.addPredefGlobal(val);
            });
            options.join(',').split(',').forEach(function (val, i) {
                self.setInlineOption(val);
            });
        }
    },

    runCheck: function () {
        var tmUrlBase = 'txmt://open?url=file://' + this.filePath,
            output = $('#lint-output'),
            errorList = $('<ul>', { id: 'lint-errors' }),
            errors = [],
            numErrors = 0,
            dispNumErrors = 0,
            ret = false,
            lastLine = false,
            impliedsList = false,
            implieds = [],
            self = this;

        TextMate.isBusy = true;
        output.html('Please wait..');

        ret = JSLINT(this.input, this.options);

        this.updateLintString();
        $('#JSLINT_PREDEF_GLOBALS').val(this.getPredefGlobals());
        output.empty();

        if (!ret && JSLINT.errors.length) {
            errors = JSLINT.errors.filter(function (e, i) {
                return (e && typeof e === 'object');
            });

            numErrors = dispNumErrors = errors.length;

            if (('reason' in errors[numErrors-1]) && /^Too many errors\./.test(errors[numErrors-1].reason)) {
                dispNumErrors--;
            }

            $('<div>', {
                'class': 'lint-fail',
                text: dispNumErrors + ' error' + (dispNumErrors > 1 ? 's' : '') + ' found'
            }).appendTo(output);

            errors.forEach(function (e, i) {
                var url = tmUrlBase + '&line=' + e.line + '&column=' + e.character,
                    tip = 'Go to line ' + e.line + ', column ' + e.character,
                    item = $('<li>'),
                    reason = $('<div>', { 'class': 'lint-reason', text: e.reason }).appendTo(item),
                    link = $('<a>', { 'class': 'lint-error', href: url, title: tip }).appendTo(item);

                if ('raw' in e && "'{a}' is not defined." === e.raw) {
                    $('<button>', {
                        text: 'Add to Predefined',
                        title: "Add '" + e.a + "' to list of predefined globals",
                        click: function (ev) {
                            ev.preventDefault();
                            self.addPredefGlobal(e.a);
                            self.disableInlineOptions();
                            self.runCheck();
                        }
                    }).appendTo(reason);
                }

                $('<div>', {
                    'class': 'line-col',
                    text: 'Line ' + e.line + ' Col ' + e.character
                }).appendTo(link);

                if ('evidence' in e && e.evidence) {
                    $('<pre>', { text: e.evidence, 'class': 'evidence' }).appendTo(link);
                }

                item.appendTo(errorList);
            });

            errorList.appendTo(output);
        } else if (!ret && !JSLINT.errors.length) {
            $('<div>', { 'class': 'lint-fail', text: 'Unknown error.' }).appendTo(output);
        } else {
            $('<div>', { 'class': 'lint-success', text: 'jslint: No problems found.' }).appendTo(output);
        }

        $('<a>', {
            href: '#',
            text: 'View Report',
            click: function (e) {
                e.preventDefault();
                $(output).append(JSLINT.report());
            }
        }).appendTo(output);

        TextMate.isBusy = false;
    }
};

window.tm_jslint = tm_jslint;

}());
