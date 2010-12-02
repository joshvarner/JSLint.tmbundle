/*jslint white:false,regexp:false */
/*globals $,window,TextMate,JSLINT */

(function () {

var tm_jslint = {
    input: '',
    filePath: '',
    options: {
        adsafe:   false,
        bitwise:  true,
        browser:  false,
        cap:      false,
        css:      false,
        debug:    false,
        devel:    false,
        eqeqeq:   true,
        es5:      false,
        evil:     false,
        forin:    false,
        fragment: false,
        immed:    true,
        laxbreak: false,
        newcap:   true,
        nomen:    true,
        on:       false,
        onevar:   true,
        passfail: false,
        plusplus: true,
        regexp:   true,
        rhino:    false,
        undef:    true,
        safe:     false,
        windows:  false,
        strict:   false,
        sub:      false,
        white:    true,
        widget:   false
    },
    checkboxes: {
        passfail: 'Stop on first error',
        white:    'Strict white space',
        browser:  'Assume a browser',
        devel:    'Assume <code>console</code>, <code>alert</code>, ...',
        widget:   'Assume a Yahoo Widget',
        windows:  'Assume Windows',
        rhino:    'Assume Rhino',
        safe:     'Safe Subset',
        adsafe:   'ADsafe',
        debug:    'Tolerate <tt>debugger</tt> statements',
        evil:     'Tolerate <tt>eval</tt>',
        laxbreak: 'Tolerate sloppy line breaking',
        forin:    'Tolerate unfiltered <tt>for</tt> <tt>in</tt>',
        sub:      'Tolerate inefficient subscripting',
        css:      'Tolerate CSS workarounds',
        cap:      'Tolerate <tt>HTML</tt> case',
        on:       'Tolerate <tt>HTML</tt> event handlers',
        fragment: 'Tolerate <tt>HTML</tt> fragments',
        es5:      'Tolerate ES5 syntax',
        onevar:   'Allow one <tt>var</tt> statement per function',
        undef:    'Disallow undefined variables',
        nomen:    'Disallow dangling <tt>_</tt> in identifiers',
        eqeqeq:   'Disallow <tt> == </tt> and <tt> != </tt>',
        plusplus: 'Disallow <tt>++</tt> and <tt>--</tt>',
        bitwise:  'Disallow bitwise operators',
        regexp:   'Disallow insecure <tt>.</tt> and <tt>[^</tt>...<tt>]</tt> in /RegExp/',
        newcap:   'Require Initial Caps for constructors',
        immed:    'Require parens around immediate invocations',
        strict:   'Require <tt>"use strict";</tt>'
    },
    
    init: function () {
        var div = $('<div>');

        $.each(this.checkboxes, function (name, desc) {
            $('<label>', { title: name, html: desc })
                .prepend($('<input>', {
                    type: 'checkbox',
                    id: 'JSLINT_' + name.toUpperCase(),
                    title: name
                }))
                .appendTo(div);
        });

        div.prependTo('#JSLINT_OPTIONS');
        
        $('#JSLINT_JSLINTSTRING').bind({
            click: function (e) {
                $(this).select();
            }
        });
        
        $('#JSLINT_OPTIONS').find(':checkbox').bind({
            click: function (e) {
                var self = $(this);

                tm_jslint.options[self.attr('title')] = self.is(':checked');
                // Disable in-code options, since we're forcing a change, but don't remove the
                // comment or we'll mess up line numbers
                tm_jslint.input = tm_jslint.input.replace(/\/\*(jslint)\b(?=[^\/*]+\*\/)/i, '/*______');
                tm_jslint.runCheck();
            }
        });
    },
    
    runCheck: function () {
        var tmUrlBase = 'txmt://open?url=file://' + this.filePath,
            output = $('#lint-output'),
            lintOpts = [],
            errorList = $('<ul>', { id: 'lint-errors' }),
            errors = [],
            numErrors = 0,
            ret = false,
            lastLine = false,
            self = this;

        TextMate.isBusy = true;
        output.html('Please wait..');

        ret = JSLINT(this.input, this.options);

        $.each(this.options, function (name, value) {
            if (name in self.checkboxes) {
                if (!!value) {
                    $('#JSLINT_' + name.toUpperCase()).attr('checked', 'checked');
                } else {
                    $('#JSLINT_' + name.toUpperCase()).removeAttr('checked');
                }
                
                lintOpts.push(name + ':' + (self.options[name] ? 'true' : 'false'));
            }
        });

        if (this.options.white && +this.options.indent) {
            lintOpts.push('indent:' + this.options.indent);
        }

        if (+this.options.maxlen) {
            lintOpts.push('maxlen:' + this.options.maxlen);
        }

        if (+this.options.maxerr) {
            lintOpts.push('maxerr:' + this.options.maxerr);
        }

        $('#JSLINT_JSLINTSTRING').text('/*jslint ' + lintOpts.join(', ') + ' */');

        output.empty();

        if (!ret && JSLINT.errors.length) {
            errors = JSLINT.errors.filter(function (e, i) {
                return (e && typeof e === 'object');
            });

            numErrors = errors.length;

            $('<div>', {
                'class': 'lint-fail',
                text: '' + numErrors + ' error' + (numErrors > 1 ? 's' : '') + ' found'
            }).appendTo(output);

            errors.forEach(function (e, i) {
                var url = tmUrlBase + '&line=' + e.line + '&column=' + e.character,
                    item = $('<li>').appendTo(errorList),
                    link = $('<a>', { 'class': 'lint-error', href: url }).appendTo(item);


                $('<div>', { 'class': 'lint-reason', text: e.reason }).appendTo(link);
                $('<div>', {
                    'class': 'line-col',
                    text: 'Line ' + e.line + ' Col ' + e.character
                }).appendTo(link);

                if ('evidence' in e && e.evidence) {
                    $('<pre>', { text: e.evidence }).appendTo(link);
                }
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
