<?php

function runJsLint($forceFullRun = false) {
    $bundlePath = getenv('TM_BUNDLE_PATH') . '/Support';

    $opts = array(
        'filePath' => getenv('TM_FILEPATH'),
        'input'    => file_get_contents('php://stdin'),
        'defaults' => array(
            'adsafe'   => false,
            'bitwise'  => false,
            'browser'  => false,
            'cap'      => false,
            'css'      => false,
            'debug'    => false,
            'devel'    => false,
            'eqeqeq'   => false,
            'es5'      => false,
            'evil'     => false,
            'forin'    => false,
            'fragment' => false,
            'immed'    => false,
            'laxbreak' => false,
            'newcap'   => false,
            'nomen'    => false,
            'on'       => false,
            'onevar'   => false,
            'passfail' => false,
            'plusplus' => false,
            'regexp'   => false,
            'rhino'    => false,
            'undef'    => true,
            'safe'     => false,
            'windows'  => false,
            'strict'   => false,
            'sub'      => false,
            'white'    => true,
            'widget'   => false,
            'maxlen'   => 0,
            'maxerr'   => 50,
            'indent'   => 4,
            'predef'   => new stdClass,
        ),
    );

    $opts['jscDefaults'] = array_merge($opts['defaults'], array(
        'maxerr'   => 1,
        'passfail' => true,
    ));

    $opts = array_map('json_encode', $opts);

    define('TM_EXIT_SHOW_HTML', 205);
    define('TM_EXIT_SHOW_TOOLTIP', 206);

    $jscPath = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Resources/jsc';

    // Only continue to the HTML Output Window version if we know there are errors,
    // or if we don't have access to jsc.
    if (!$forceFullRun && file_exists($jscPath) && is_executable($jscPath)) {
        $tempFile = tempnam(sys_get_temp_dir(), 'tm_jslint');

        $js = "print(JSLINT({$opts['input']}, {$opts['jscDefaults']}) ? 'pass' : 'fail');\n";
        file_put_contents($tempFile, $js);

        $ret = exec(implode(' ', array(
            $jscPath,
            escapeshellarg($bundlePath . '/jslint.js'),
            escapeshellarg($tempFile)
        )));
        unlink($tempFile);

        if ('pass' === $ret) {
            echo 'jslint: No problems found.';
            exit(TM_EXIT_SHOW_TOOLTIP);
        }
    }

    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>JSLint Output</title>
        <script src="file://<?php echo $bundlePath; ?>/jquery.min.js" type="text/javascript" charset="utf-8"></script>
        <script src="file://<?php echo $bundlePath; ?>/jslint.js" type="text/javascript" charset="utf-8"></script>
        <script src="file://<?php echo $bundlePath; ?>/tm_jslint.js" type="text/javascript" charset="utf-8"></script>
        <link rel="stylesheet" href="file://<?php echo $bundlePath; ?>/tm_jslint.css" type="text/css" media="screen" charset="utf-8" />
    </head>
    <body>
        <fieldset id="JSLINT_OPTIONS">
            <legend>Options</legend>
            <textarea id="JSLINT_JSLINTSTRING"></textarea>
        </fieldset>
        <div id="lint-output">Please wait..</div>
        <script type="text/javascript" charset="utf-8">

        (function () {
            tm_jslint.defaults = <?php echo $opts['defaults']; ?>;
            tm_jslint.filePath = <?php echo $opts['filePath']; ?>;
            tm_jslint.input = <?php echo $opts['input']; ?>;

            tm_jslint.init();
            tm_jslint.runCheck();
        })();

        </script>
    </body>
    </html>
    <?php

    exit(TM_EXIT_SHOW_HTML);
}
