<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\PackBuilder;

/** Packs hors connexion : une catégorie à télécharger, dans toutes les langues. */
class PackController extends Controller
{
    /** GET /api/v1/packs : catégorie, version, taille, nombre d'objets. */
    public function index(PackBuilder $packs)
    {
        return response()->json(['data' => $packs->summaries()]);
    }

    /** GET /api/v1/packs/{slug} : le contenu du pack et l'adresse de chaque fichier. */
    public function show(Category $category, PackBuilder $packs)
    {
        abort_unless($category->is_published, 404);

        return response()->json($packs->build($category));
    }
}
