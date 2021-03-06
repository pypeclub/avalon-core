/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true,
indent: 4, maxerr: 50 */
/*global $, Folder*/
#include "../js/libs/json.js";


app.preferences.savePrefAsBool("General Section", "Show Welcome Screen", false) ;


function sayHello(){
    alert("hello from ExtendScript");
}

function getEnv(variable){
    return $.getenv(variable);
}

function getMetadata(){
    /**
     *  Returns payload in 'Label' field of project's metadata
     * 
     **/
    if (ExternalObject.AdobeXMPScript === undefined){
        ExternalObject.AdobeXMPScript =
            new ExternalObject('lib:AdobeXMPScript');
    }
    
    var proj = app.project;
    var meta = new XMPMeta(app.project.xmpPacket);
    var schemaNS = XMPMeta.getNamespaceURI("xmp");
    var label = "xmp:Label";

    if (meta.doesPropertyExist(schemaNS, label)){
        var prop = meta.getProperty(schemaNS, label);
        return prop.value;
    }

    return null;

}

function imprint(payload){
    /**
     * Stores payload in 'Label' field of project's metadata
     * 
     * Args:
     *     payload (string): json content
     */
    if (ExternalObject.AdobeXMPScript === undefined){
        ExternalObject.AdobeXMPScript =
            new ExternalObject('lib:AdobeXMPScript');
    }
    
    var proj = app.project;
    var meta = new XMPMeta(app.project.xmpPacket);
    var schemaNS = XMPMeta.getNamespaceURI("xmp");
    var label = "xmp:Label";

    meta.setProperty(schemaNS, label, payload);
    
    app.project.xmpPacket = meta.serialize();
}


function fileOpen(path){
    /**
     * Opens (project) file on 'path'
     */
    fp = new File(path);
    return app.open(fp);
}

function getActiveDocumentName(){
    /**
     *   Returns file name of active document
     * */
    var file = app.project.file;

    if (file){
        return file.name;   
    }

    return null;
}

function getActiveDocumentFullName(){
    /**
     *   Returns absolute path to current project
     * */
    var file = app.project.file;

    if (file){
        var f = new File(file.fullName);
        var path = f.fsName;
        f.close();

        return path;   
    }

    return null;
}

function getItems(comps, folders, footages){
    /**
     * Returns JSON representation of compositions and
     * if 'collectLayers' then layers in comps too.
     * 
     * Args:
     *     comps (bool): return selected compositions
     *     folders (bool): return folders
     *     footages (bool): return FootageItem
     * Returns:
     *     (list) of JSON items
     */    
    var items = []
    for (i = 1; i <= app.project.items.length; ++i){
        var item = app.project.items[i];
        if (!item){
            continue;
        }
        var ret = _getItem(item, comps, folders, footages);
        if (ret){
            items.push(ret);
        }
    }
    return '[' + items.join() + ']';

}

function getSelectedItems(comps, folders, footages){
    /**
     * Returns list of selected items from Project menu
     * 
     * Args:
     *     comps (bool): return selected compositions
     *     folders (bool): return folders
     *     footages (bool): return FootageItem
     * Returns:
     *     (list) of JSON items
     */    
    var items = []
    for (i = 0; i < app.project.selection.length; ++i){
        var item = app.project.selection[i];
        if (!item){
            continue;
        }
        var ret = _getItem(item, comps, folders, footages);
        if (ret){
            items.push(ret);
        }
    }
    return '[' + items.join() + ']';
}

function _getItem(item, comps, folders, footages){
    /**
     * Auxiliary function as project items and selections 
     * are indexed in different way :/
     * Refactor 
     */
    var item_type = '';
    if (item instanceof FolderItem){
        item_type = 'folder';
        if (!folders){
            return null;
        }
    }
    if (item instanceof FootageItem){
        item_type = 'footage';
        if (!footages){
            return null;
        }
    }
    if (item instanceof CompItem){
        item_type = 'comp';
        if (!comps){
            return null;
        }
    }
        
    var item = {"name": item.name,
                "id": item.id,
                "type": item_type};
    return JSON.stringify(item);
}

function importFile(path, item_name, import_options){
    /**
     * Imports file (image tested for now) as a FootageItem.
     * Creates new composition
     * 
     * Args:
     *    path (string): absolute path to image file
     *    item_name (string): label for composition
     * Returns:
     *    JSON {name, id}
     */
    var comp;
    var ret = {};
    try{
        import_options = JSON.parse(import_options);
    } catch (e){
        alert("Couldn't parse import options " + import_options);
    }

    app.beginUndoGroup("Import File");
    fp = new File(path);
    if (fp.exists){
        try { 
            im_opt = new ImportOptions(fp);
            importAsType = import_options["ImportAsType"];

            if ('ImportAsType' in import_options){ // refactor
                if (importAsType.indexOf('COMP') > 0){
                    im_opt.importAs = ImportAsType.COMP;
                }
                if (importAsType.indexOf('FOOTAGE') > 0){
                    im_opt.importAs = ImportAsType.FOOTAGE;
                }
                if (importAsType.indexOf('COMP_CROPPED_LAYERS') > 0){
                    im_opt.importAs = ImportAsType.COMP_CROPPED_LAYERS;
                }
                if (importAsType.indexOf('PROJECT') > 0){
                    im_opt.importAs = ImportAsType.PROJECT;
                }  
                             
            }
            if ('sequence' in import_options){
                im_opt.sequence = true;
            }
            
            comp = app.project.importFile(im_opt);

            if (app.project.selection.length == 2 &&
                app.project.selection[0] instanceof FolderItem){
                 comp.parentFolder = app.project.selection[0]   
            }
        } catch (error) {
            $.writeln(error);
            alert(error.toString() + importOptions.file.fsName, scriptName);
        } finally {
            fp.close();
        }
    }
    if (comp){
        comp.name = item_name;
        comp.label = 9; // Green
        $.writeln(comp.id);
        ret = {"name": comp.name, "id": comp.id}
    }
    app.endUndoGroup();

    return JSON.stringify(ret);
}

function setLabelColor(comp_id, color_idx){
    /**
     * Set item_id label to 'color_idx' color
     * Args:
     *     item_id (int): item id
     *     color_idx (int): 0-16 index from Label
     */
    var item = app.project.itemByID(comp_id);
    if (item){
        item.label = color_idx;
    }else{
        alert("There is no composition with "+ comp_id);
    }
}

function replaceItem(comp_id, path, item_name){
    /**
     * Replaces loaded file with new file and updates name
     * 
     * Args:
     *    comp_id (int): id of composition, not a index!
     *    path (string): absolute path to new file
     *    item_name (string): new composition name
     */
    app.beginUndoGroup("Replace File");
    
    fp = new File(path);
    var item = app.project.itemByID(comp_id);
    if (item){
        try{
            item.replace(fp);
            item.name = item_name;
        } catch (error) {
            alert(error.toString() + path, scriptName);
        } finally {
            fp.close();
        }
    }else{
        alert("There is no composition with "+ comp_id);
    }
    app.endUndoGroup();
}

function renameItem(comp_id, new_name){
    var item = app.project.itemByID(comp_id);
    if (item){
        item.name = new_name;
    }else{
        alert("There is no composition with "+ comp_id);
    }
}

function deleteItem(comp_id){
    var item = app.project.itemByID(comp_id);
    if (item){
        item.remove();
    }else{
        alert("There is no composition with "+ comp_id);
    }  
}

function getWorkArea(comp_id){
    /**
     * Returns information about workarea - are that will be
     * rendered. All calculation will be done in Pype, 
     * easier to modify without redeploy of extension.
     * 
     * Returns dict
     */
    var item = app.project.itemByID(comp_id);
    if (item){
        return JSON.stringify({
            "workAreaStart": item.displayStartFrame, 
            "workAreaDuration": item.duration,
            "frameRate": item.frameRate});
    }else{
        alert("There is no composition with "+ comp_id);
    }  
}

function setWorkArea(comp_id, workAreaStart, workAreaDuration, frameRate){
    /**
     * Sets work area info from outside (from Ftrack via Pype)
     */
    var item = app.project.itemByID(comp_id);
    if (item){
        item.displayStartTime = workAreaStart;
        item.duration = workAreaDuration;
        item.frameRate = frameRate;
    }else{
        alert("There is no composition with "+ comp_id);
    } 
}

function save(){
    /**
     * Saves current project
     */
    return app.project.save();  //TODO path is wrong, File instead
}

function saveAs(path){
    /**
     *   Saves current project as 'path'
     * */
    return app.project.save(fp = new File(path));
}

function getRenderInfo(){
    /***
        Get info from render queue.
        Currently pulls only file name to parse extension and 
        if it is sequence in Python
    **/
    try{
        var render_queue = app.project.renderQueue.item(1);
        render_queue.render = true; // always set render queue to render
        var item = render_queue.outputModule(1);
    } catch (error) {
        alert("There is no render queue, create one.");
    }
    var file_url = item.file.toString();

    return JSON.stringify({
        "file_name": file_url            
    })
}

function getAudioUrlForComp(comp_id){
    var item = app.project.itemByID(comp_id);
    if (item){
        for (i = 1; i <= item.numLayers; ++i){
            var layer = item.layers[i];
            if (layer instanceof AVLayer){
                return layer.source.file.fsName.toString();
            }

        }
    }else{
        alert("There is no composition with "+ comp_id);
    }

}

function addItemAsLayerToComp(comp_id, item_id, found_comp){
    /**
     * Adds already imported FootageItem ('item_id') as a new
     * layer to composition ('comp_id').
     * 
     * Args:
     *  comp_id (int): id of target composition
     *  item_id (int): FootageItem.id
     *  found_comp (CompItem, optional): to limit quering if
     *      comp already found previously
     */
    var comp = found_comp || app.project.itemByID(comp_id);
    if (comp){
        item = app.project.itemByID(item_id);
        if (item){
            comp.layers.add(item);
        }else{
            alert("There is no item with " + item_id);
        }
    }else{
        alert("There is no composition with "+ comp_id);
    }
}

function importBackground(comp_id, composition_name, files_to_import){
    /**
     * Imports backgrounds images to existing or new composition.
     * 
     * If comp_id is not provided, new composition is created, basic
     * values (width, heights, frameRatio) takes from first imported
     * image.
     * 
     * Args:
     *   comp_id (int): id of existing composition (null if new)
     *   composition_name (str): used when new composition 
     *   files_to_import (list): list of absolute paths to import and
     *      add as layers
     * 
     * Returns:
     *  (str): json representation (id, name, members)
     */
    var comp;
    var folder;
    var imported_ids = [];
    if (comp_id){
        comp = app.project.itemByID(comp_id);
        folder = comp.parentFolder;
    }else{
        if (app.project.selection.length > 1){
            alert("Too many items selected, select only target composition!");
            return false;
        }else{
            selected_item = app.project.activeItem;
            if (selected_item instanceof Folder){
                comp = selected_item;
                folder = selected_item;
            }
        }
    }
       
    if (files_to_import){
        for (i = 0; i < files_to_import.length; ++i){
            item = _importItem(files_to_import[i]);
            if (!item){
                alert("No item for " + item_json["id"] + ". Import failed.");
                return false;
            }
            if (!comp){
                folder = app.project.items.addFolder(composition_name);
                imported_ids.push(folder.id);
                comp = app.project.items.addComp(composition_name, item.width, 
                    item.height, item.pixelAspect, 
                    1, 26.7);  // hardcode defaults
                imported_ids.push(comp.id);
                comp.parentFolder = folder;
            }
            imported_ids.push(item.id)
            item.parentFolder = folder;

            addItemAsLayerToComp(comp.id, item.id, comp);
        }       
    }
    var item = {"name": comp.name,
                "id": folder.id,
                "members": imported_ids};
    return JSON.stringify(item);
}

function reloadBackground(comp_id, composition_name, files_to_import){
    /**
     * Reloads existing composition.
     * 
     * It deletes complete composition with encompassing folder, recreates
     * from scratch via 'importBackground' functionality.
     * 
     * Args:
     *   comp_id (int): id of existing composition (null if new)
     *   composition_name (str): used when new composition 
     *   files_to_import (list): list of absolute paths to import and
     *      add as layers
     * 
     * Returns:
     *  (str): json representation (id, name, members)
     * 
     */
    comp = app.project.itemByID(comp_id);
    folder = comp.parentFolder;
    if (folder){
        folder.remove();
    }else{
        comp.remove();
    }
    return importBackground(null, composition_name, files_to_import);
}

function _importItem(file_url){
    fp = new File(file_url);
    file_name = fp.name.substring(0, fp.name.lastIndexOf("."));
    
    //importFile prepared previously to return json
    item_json = importFile(file_url, file_name, JSON.stringify({"ImportAsType":"FOOTAGE"}));
    item_json = JSON.parse(item_json);
    item = app.project.itemByID(item_json["id"]);

    return item;
}
 
// var img = 'c:\\projects\\petr_test\\assets\\locations\\Jungle\\publish\\image\\imageBG\\v013\\petr_test_Jungle_imageBG_v013.jpg';
// var psd = 'c:\\projects\\petr_test\\assets\\locations\\Jungle\\publish\\workfile\\workfileArt\\v013\\petr_test_Jungle_workfileArt_v013.psd';
// var mov = 'c:\\Users\\petrk\\Downloads\\Samples\\sample_iTunes.mov';
// var wav = 'c:\\Users\\petrk\\Downloads\\Samples\\africa-toto.wav';

// var inop = JSON.stringify({sequence: true});
// $.writeln(inop);
// importFile(mov, "mov", inop); // should be able to import PSD and all its layers
//importFile(mov, "new_wav");
// $.writeln(app.project.selection);
// for (i = 1; i <= app.project.selection.length; ++i){
//     var sel = app.project.selection[i];
//     $.writeln(sel);
//     $.writeln(app.project.selection[0] instanceof FolderItem);
//}

//addItemAsLayerToComp(60, 1);
//$.writeln(importBackground(null, 'New comp', [img]));

//deleteItem(600);
// files_to_import =[
//     'C:/projects/petr_test/assets/locations/Jungle/publish/background/backgroundComp/v002/03_FG_01_Layer_1.png',
//     'C:/projects/petr_test/assets/locations/Jungle/publish/background/backgroundComp/v002/03_FG_02_Layer_2.png'
// ]
// reloadBackground(707, 'Jungle_backgroundComp_001', files_to_import);




