// ==UserScript==
// @name         GCOR Licensee Fetcher
// @namespace    http://tampermonkey.net/
// @version      10.0
// @description  Fetch licensees from Mystiq API directly on the Mystiq brands page
// @match        https://mystiq-ui-na-iad.iad.proxy.amazon.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function(){
    'use strict';

    var launchBtn = null;

    function shouldShowButton(){
        return window.location.hash === '#/brands' || window.location.hash.startsWith('#/brands?');
    }

    function createButton(){
        if(launchBtn) return;
        launchBtn = document.createElement('button');
        launchBtn.innerHTML = '🐮 Licensee Fetcher';
        launchBtn.id = 'gcor-launch-btn';
        launchBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;padding:12px 20px;background:#3498db;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
        launchBtn.addEventListener('mouseenter', function(){ launchBtn.style.background = '#2980b9'; });
        launchBtn.addEventListener('mouseleave', function(){ launchBtn.style.background = '#3498db'; });
        launchBtn.addEventListener('click', function(){ openFetcherPanel(); });
        document.body.appendChild(launchBtn);
    }

    function removeButton(){
        if(launchBtn){
            launchBtn.remove();
            launchBtn = null;
        }
    }

    function checkPage(){
        if(shouldShowButton()){
            createButton();
        } else {
            removeButton();
        }
    }

    checkPage();
    window.addEventListener('hashchange', checkPage);

    function openFetcherPanel(){
        var existing = document.getElementById('gcor-fetcher-panel');
        if(existing){ existing.remove(); return; }

        var panel = document.createElement('div');
        panel.id = 'gcor-fetcher-panel';
        panel.innerHTML = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#f5f7fa;z-index:100000;display:flex;flex-direction:column;overflow:hidden;">'
            + '<div style="background:white;padding:20px 30px;box-shadow:0 2px 8px rgba(0,0,0,0.1);display:flex;justify-content:space-between;align-items:center;">'
            + '<h2 style="margin:0;color:#2c3e50;font-size:24px;">🐮 GCOR Licensee Fetcher</h2>'
            + '<button id="gcor-close-btn" style="background:#e74c3c;color:white;border:none;font-size:14px;cursor:pointer;padding:8px 16px;border-radius:6px;">✕ Close</button>'
            + '</div>'
            + '<div style="flex:1;overflow-y:auto;padding:30px;">'
            + '<div style="max-width:1200px;margin:0 auto;">'
            + '<div style="background:white;border-radius:12px;padding:25px;box-shadow:0 4px 12px rgba(0,0,0,0.05);margin-bottom:25px;">'
            + '<label style="font-weight:600;color:#34495e;display:block;margin-bottom:10px;font-size:15px;">GCOR IDs:</label>'
            + '<textarea id="gcor-input" placeholder="Enter GCOR ID" style="width:100%;height:120px;padding:12px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>'
            + '<div style="display:flex;justify-content:space-between;margin-top:15px;">'
            + '<button id="gcor-fetch-btn" style="background:#3498db;color:white;border:none;padding:12px 25px;font-size:14px;border-radius:8px;cursor:pointer;">Fetch Licensees</button>'
            + '<button id="gcor-refresh-btn" style="background:#e67e22;color:white;border:none;padding:12px 25px;font-size:14px;border-radius:8px;cursor:pointer;">🔄 Refresh</button>'
            + '</div>'
            + '<div id="gcor-status" style="margin-top:12px;"></div>'
            + '</div>'
            + '<div id="gcor-results" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:20px;"></div>'
            + '</div>'
            + '</div>'
            + '</div>';
        document.body.appendChild(panel);

        document.getElementById('gcor-close-btn').addEventListener('click', function(){ panel.remove(); });

        // Refresh button - clears input, status, and results
        document.getElementById('gcor-refresh-btn').addEventListener('click', function(){
            document.getElementById('gcor-input').value = '';
            document.getElementById('gcor-status').innerHTML = '';
            document.getElementById('gcor-results').innerHTML = '';
        });

        document.getElementById('gcor-fetch-btn').addEventListener('click', async function(){
            var input = document.getElementById('gcor-input').value;
            var status = document.getElementById('gcor-status');
            var results = document.getElementById('gcor-results');
            var fetchBtn = document.getElementById('gcor-fetch-btn');

            if(!input.trim()){ alert('Please enter at least one GCOR ID.'); return; }

            var splitRegex = new RegExp('[,\\n]+');
            var gcorList = [...new Set(input.split(splitRegex).map(function(id){ return id.trim(); }).filter(Boolean))];
            results.innerHTML = '';
            status.innerHTML = '<div style="padding:10px;background:#fff3cd;color:#856404;border-radius:6px;font-weight:600;">⏳ Fetching licensees for ' + gcorList.length + ' GCOR(s)...</div>';
            fetchBtn.disabled = true;
            fetchBtn.textContent = 'Fetching...';
            fetchBtn.style.background = '#95a5a6';

            var successCount = 0;
            var errorCount = 0;

            for(var i = 0; i < gcorList.length; i++){
                var gcor = gcorList[i];
                var brandName = '';
                try{
                    // Fetch brand name
                    var nameUrl = 'https://mystiq-ui-na-iad.iad.proxy.amazon.com/brands/names?gcorId=' + gcor;
                    var nameResponse = await fetch(nameUrl, {credentials: 'include'});

                    if(!nameResponse.ok){
                        renderInvalidResult(results, gcor);
                        errorCount++;
                        continue;
                    }

                    brandName = await nameResponse.text();
                    brandName = brandName.trim();

                    if(!brandName){
                        renderInvalidResult(results, gcor);
                        errorCount++;
                        continue;
                    }

                    // Fetch licensees
                    var url = 'https://mystiq-ui-na-iad.iad.proxy.amazon.com/brands/properties?gcorId=' + gcor + '&marketplaceCode=&propertyKey=licensee';
                    var response = await fetch(url, {credentials: 'include'});

                    if(!response.ok){
                        renderInvalidResult(results, gcor);
                        errorCount++;
                        continue;
                    }

                    var data = await response.json();
                    var licensees = data.propertyValues || [];
                    renderResult(results, gcor, brandName, licensees);
                    successCount++;
                } catch(error){
                    renderInvalidResult(results, gcor);
                    errorCount++;
                }
            }

            if(errorCount === 0){
                status.innerHTML = '<div style="padding:10px;background:#d4edda;color:#155724;border-radius:6px;font-weight:600;">✅ Successfully fetched licensees for ' + successCount + ' GCOR(s)</div>';
            } else if(successCount === 0){
                status.innerHTML = '<div style="padding:10px;background:#f8d7da;color:#721c24;border-radius:6px;font-weight:600;">❌ No valid GCOR IDs found. Please check and try again.</div>';
            } else {
                status.innerHTML = '<div style="padding:10px;background:#f8d7da;color:#721c24;border-radius:6px;font-weight:600;">⚠️ Completed: ' + successCount + ' valid, ' + errorCount + ' invalid GCOR(s)</div>';
            }

            fetchBtn.disabled = false;
            fetchBtn.textContent = 'Fetch Licensees';
            fetchBtn.style.background = '#3498db';
        });
    }

    function renderInvalidResult(container, gcor){
        var card = document.createElement('div');
        card.style.cssText = 'background:white;border-radius:10px;padding:20px;box-shadow:0 4px 12px rgba(0,0,0,0.05);border-left:4px solid #e74c3c;';
        card.innerHTML = '<div style="text-align:center;"><div style="font-size:32px;margin-bottom:10px;">⚠️</div><div style="font-size:16px;font-weight:700;color:#e74c3c;">Invalid GCOR: ' + escapeHTML(gcor) + '</div><p style="color:#7f8c8d;font-size:13px;margin-top:8px;">This GCOR ID does not exist. Please enter a valid GCOR ID and try again.</p></div>';
        container.appendChild(card);
    }

    function renderResult(container, gcor, brandName, licensees, error){
        var card = document.createElement('div');
        card.style.cssText = 'background:white;border-radius:10px;padding:20px;box-shadow:0 4px 12px rgba(0,0,0,0.05);';
        var listHTML = '';
        if(error){
            listHTML = '<p style="color:#e74c3c;font-style:italic;">❌ ' + error + '</p>';
        } else if(licensees.length > 0){
            listHTML = '<div style="max-height:300px;overflow-y:auto;"><ul style="list-style:none;padding:0;margin:0;">' + licensees.map(function(l){ return '<li style="padding:8px 12px;margin:4px 0;background:#f8f9fa;border-radius:6px;font-size:13px;border-left:3px solid #3498db;">' + escapeHTML(l) + '</li>'; }).join('') + '</ul></div>';
        } else {
            listHTML = '<p style="color:#95a5a6;font-style:italic;">No licensees found</p>';
        }

        var headerText = brandName ? escapeHTML(brandName) + ' (GCOR: ' + gcor + ')' : 'GCOR: ' + gcor;

        card.innerHTML = '<div style="text-align:center;border-bottom:2px solid #ecf0f1;padding-bottom:12px;margin-bottom:12px;"><div style="font-size:18px;font-weight:700;color:#2c3e50;">' + headerText + '</div><div style="font-size:12px;color:#3498db;font-weight:600;margin-top:4px;">' + licensees.length + ' licensee' + (licensees.length !== 1 ? 's' : '') + '</div></div>' + listHTML;

        if(licensees.length > 0 && !error){
            var copyBtn = document.createElement('button');
            copyBtn.textContent = '📋 Copy All ' + licensees.length + ' Licensees';
            copyBtn.style.cssText = 'display:block;margin:12px auto 0;background:#27ae60;color:white;border:none;padding:10px 16px;border-radius:6px;font-size:13px;cursor:pointer;';
            copyBtn.addEventListener('click', function(){
                var text = licensees.join('\n');
                navigator.clipboard.writeText(text).then(function(){
                    copyBtn.textContent = '✅ Copied!';
                    copyBtn.style.background = '#2ecc71';
                    setTimeout(function(){
                        copyBtn.textContent = '📋 Copy All ' + licensees.length + ' Licensees';
                        copyBtn.style.background = '#27ae60';
                    }, 2000);
                });
            });
            card.appendChild(copyBtn);
        }
        container.appendChild(card);
    }

    function escapeHTML(str){
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
})();
