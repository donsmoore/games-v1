<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$assetsDir = __DIR__;
$files = scandir($assetsDir);
$assets = [];

foreach ($files as $file) {
    if (pathinfo($file, PATHINFO_EXTENSION) === 'obj') {
        $baseName = pathinfo($file, PATHINFO_FILENAME);
        
        // Skip backup files
        if (strpos($baseName, '_ORIGINAL') !== false || strpos($baseName, '_BACKUP') !== false) {
            continue;
        }
        
        // Create display name: capitalize words, replace underscores with spaces
        $displayName = str_replace('_', ' ', $baseName);
        $displayName = str_replace(',', '', $displayName); // Remove commas
        $displayName = ucwords($displayName);
        
        $assets[] = [
            'id' => $baseName,
            'name' => $displayName,
            'objFile' => $file,
            'mtlFile' => $baseName . '.mtl'
        ];
    }
}

// Sort by name
usort($assets, function($a, $b) {
    return strcmp($a['name'], $b['name']);
});

echo json_encode($assets, JSON_PRETTY_PRINT);
?>

