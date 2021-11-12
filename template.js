var Template = function (base) {
    var referenceTable = new Map();
    var bindComponent = function (key, value) {
        if (!(typeof value == "string" || value instanceof Template)) {
            return false;
        }
        referenceTable.set(key, value);
        return true;
    }
    var compile = function (higherReferenceTable = null) {
        var mergedReferenceTable = new Map();
        referenceTable.forEach((value, key) => {
            mergedReferenceTable.set(key, value);
        })
        if (higherReferenceTable instanceof Map) {
            //if a higherLevel reference table is recieved, merge it with the existing referenceTable
            //references in existing table have higher precedence than the higherLevel
            higherReferenceTable.forEach((value, key) => {
                if (mergedReferenceTable.has(key)) return; //give the existing values priority
                mergedReferenceTable.set(key, value);
            })
        }
        var printPhrase = /{{\s*?([a-zA-Z]+)\s*?}}/gm;
        var resolvedReference = new Map();
        var compiled = base;
        var it;
        while (it = printPhrase.exec(base)) {
            var reference = it[1];
            if (resolvedReference.has(reference)) {
                //we have already resolved it so move on
                continue;
            }
            if (!mergedReferenceTable.has(reference)) {
                throw new Error(`Template: Unresolved Reference -> ${reference}`);
            }
            resolvedReference.set(reference, 1);
            var component = "";
            var value = mergedReferenceTable.get(reference);
            if (value instanceof Template) {
                component = value.compile(mergedReferenceTable); //referenceTable in this scope is passed down to subComponents
            } else {
                //since bindComponent rejects any other type than (string | Template)
                //it has got to be string in this part of the if
                component = value;
            }
            compiled = compiled.split(it[0]).join(component); // A non performance-critical idiom for replaceAll in string
        }
        return compiled;
    }
    this.compile = compile;
    this.bindComponent = bindComponent;
}