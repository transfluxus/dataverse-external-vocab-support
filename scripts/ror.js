console.log("ror.js..");
const rorSelector = "span[data-cvoc-protocol='ror']";
const rorInputSelector = "input[data-cvoc-protocol='ror']";
const rorRetrievalUrl = "https://api.ror.org/organizations";
const rorIdStem = "https://ror.org/";
const rorPrefix = "ror";
//Max chars that displays well for a child field
const rorMaxLength = 26;

$(document).ready(function() {
    var head = document.getElementsByTagName('head')[0];
    var js = document.createElement("script");
    js.type = "text/javascript";
    js.src = "./cvocutils.js";
    head.appendChild(js);
    
    expandRors();
    updateRorInputs();
});

function expandRors() {
    console.log("expandRors");
    // Check each selected element
    $(rorSelector).each(function() {
        var rorElement = this;
        // If it hasn't already been processed
        if (!$(rorElement).hasClass('expanded')) {
            // Mark it as processed
            $(rorElement).addClass('expanded');
            var id = rorElement.textContent;
            if (!id.startsWith(rorIdStem)) {
                getRorDisplayHtml(name, ['No ROR Entry']);
            } else {
                //Remove the URL prefix - "https://ror.org/".length = 16
                id = id.substring(rorIdStem.length);
                //Check for cached entry
                let value = getValue(rorPrefix, id);
                if(value.name !=null) {
                    rorElement.innerHTML = getRorDisplayHtml(value.name, value.altNames);
                } else {
                    // Try it as an ROR entry (could validate that it has the right form or can just let the GET fail)
                    $.ajax({
                        type: "GET",
                        url: retrievalUrl + "/" + id,
                        dataType: 'json',
                        headers: {
                            'Accept': 'application/json',
                        },
                        success: function(ror, status) {
                            console.log(ror);
                            // If found, construct the HTML for display
                            var name = ror.name;
                            var altNames= ror.acronyms;
    
                            rorElement.innerHTML = getRorDisplayHtml(name, altNames);
                            //Store values in localStorage to avoid repeating calls to CrossRef
                            setValue(rorPrefix, id, name + "#" + altNames);
                        },
                        failure: function(jqXHR, textStatus, errorThrown) {
                            // Generic logging - don't need to do anything if 404 (leave
                            // display as is)
                            if (jqXHR.status != 404) {
                                console.error("The following error occurred: " + textStatus, errorThrown);
                            }
                        }
                    });
                }
            }
        }
    });
}

function getRorDisplayHtml(name, altNames) {
    if (name.length >= fundregMaxLength) {
        // show the first characters of a long name
        // return item.text.substring(0,25) + "…";
        altNames.unshift(name);
        name=name.substring(0,fundregMaxLength) + "…";
    }
    return "<span title='" + altNames + "'>" + name + "</span>";
}

function updateRorInputs() {
    // For each input element within rorInputSelector elements
    $(rorInputSelector).each(function() {
        var rorInput = this;
        if (!rorInput.hasAttribute('data-ror')) {
            // Random identifier
            let num = Math.floor(Math.random() * 100000000000);
            // Hide the actual input and give it a data-ror number so we can
            // find it
            $(rorInput).hide();
            $(rorInput).attr('data-ror', num);
            // Todo: if not displayed, wait until it is to then create the
            // select 2 with a non-zero width
            // Add a select2 element to allow search and provide a list of
            // choices
            var selectId = "rorAddSelect_" + num;
            $(rorInput).after(
                '<select id=' + selectId + ' class="form-control add-resource select2" tabindex="-1" aria-hidden="true">');
            $("#" + selectId).select2({
                theme: "classic",
                tags: $(rorInput).attr('data-cvoc-allowfreetext'),
                delay: 500,
                templateResult: function(item) {
                    // No need to template the searching text
                    if (item.loading) {
                        return item.text;
                    }
                    // markMatch bolds the search term if/where it appears in
                    // the result
                    var $result = markMatch2(item.text, term);
                    return $result;
                },
                templateSelection: function(item) {
                    // For a selection, format as in display mode
                    //Find/remove the id number
                    var pos = item.text.search(/, \d{9}/);
                        console.log("pos: " + pos);
                    if (pos >= 0) {
                        console.log("pos greater than zero: " + pos);
                        var name = item.text.substr(0, pos);
                        var idnum = item.text.substr(pos+2);
                        return getRorDisplayHtml(name, altNames);
                    }
                    return getRorDisplayHtml(name, ['No ROR Entry']);
                },
                language: {
                    searching: function(params) {
                        // Change this to be appropriate for your application
                        return 'Search by name or acronym…';
                    }
                },
                placeholder: rorInput.hasAttribute("data-cvoc-placeholder") ? $(rorInput).attr('data-cvoc-placeholder') : "Select a research organization",
                minimumInputLength: 3,
                allowClear: true,
                ajax: {
                    // Use an ajax call to ROR to retrieve matching results
                    url: rorRetrievalUrl,
                    data: function(params) {
                        term = params.term;
                        if (!term) {
                            term = "";
                            console.log("no term!");
                        }
                        var query = {
                            query: term,
                        }
                        return query;
                    },
                    // request json
                    headers: {
                        'Accept': 'application/json'
                    },
                    processResults: function(data, params) {
                        //console.log("Data dump BEGIN");
                        //console.log(data);
                        //console.log("Data dump END");
                        return {
                            results: data['items']
                                // Sort the list
                                // Prioritize active orgs
                                .sort((a, b) => (b.status === 'active') ? 1 : -1)
                                // Prioritize those with this acronym
                                .sort((a, b) => (b.acronyms.includes(params.query)) ? 1 : -1)
                                // Prioritize previously used entries
                                .sort((a, b) => (getValue(rorPrefix, b['id'])) ? 1 : -1)
                                .map(
                                    function(x) {
                                        return {
                                            text: x.name +", " + x.id,
                                            id: x.id,
                                            altNames: x.acronyms,
                                            urls: x.links
                                        }
                                    })
                        };
                    }
                }
            });
            // If the input has a value already, format it the same way as if it
            // were a new selection
            var id = $(rorInput).val();
            if (id.startsWith(rorIdStem)) {
                id = id.substring(rorIdStem.length);
                $.ajax({
                    type: "GET",
                    url: rorRetrievalUrl + "/" + id,
                    dataType: 'json',
                    headers: {
                        'Accept': 'application/json'
                    },
                    success: function(ror, status) {
                        var name = ror.name;
                        //Display the name and id number in the selection menu
                        var text = name + ", " + ror.id;
                        var newOption = new Option(text, id, true, true);
                        newOption.altNames = ror.acronyms;
                        $('#' + selectId).append(newOption).trigger('change');
                    },
                    failure: function(jqXHR, textStatus, errorThrown) {
                        if (jqXHR.status != 404) {
                            console.error("The following error occurred: " + textStatus, errorThrown);
                        }
                    }
                });
            } else {
                // If the initial value is not in CrossRef, just display it as is
                var newOption = new Option(id, id, true, true);
                newOption.altNames = ['No ROR Entry'];
                $('#' + selectId).append(newOption).trigger('change');
            }
            // Could start with the selection menu open
            // $("#" + selectId).select2('open');
            // When a selection is made, set the value of the hidden input field
            $('#' + selectId).on('select2:select', function(e) {
                var data = e.params.data;
                // For entries from ROR, the id and text are different
                //For plain text entries (legacy or if tags are allowed), they are the same
                if (data.id != data.text) {
                    // we want just the ror url
                    $("input[data-ror='" + num + "']").val(data.id);
                } else {
                    // Tags are allowed, so just enter the text as is
                    $("input[data-ror='" + num + "']").val(data.id);
                }
            });
            // When a selection is cleared, clear the hidden input
            $('#' + selectId).on('select2:clear', function(e) {
                $("input[data-ror='" + num + "']").attr('value', '');
            });
        }
    });
}