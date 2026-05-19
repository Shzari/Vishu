"use client";

import { useEffect } from "react";
import type { Language } from "@/components/providers";

const textTranslations = new Map<string, string>([
  ["Search", "Kërko"],
  ["Search products across the marketplace", "Kërko produkte në të gjithë tregun"],
  ["Shop", "Dyqani"],
  ["Cart", "Shporta"],
  ["Account", "Llogaria"],
  ["Login", "Hyr"],
  ["Register", "Regjistrohu"],
  ["Logout", "Dil"],
  ["Continue shopping", "Vazhdo blerjen"],
  ["Review your items and move quickly to checkout.", "Kontrolloni produktet dhe vazhdoni shpejt te pagesa."],
  ["Your cart is empty.", "Shporta juaj është bosh."],
  ["Browse the marketplace and add products to start checking out.", "Shfletoni tregun dhe shtoni produkte për të nisur pagesën."],
  ["Browse products", "Shfleto produktet"],
  ["Summary", "Përmbledhje"],
  ["Subtotal", "Nëntotali"],
  ["Shipping and taxes are calculated at checkout.", "Transporti dhe taksat llogariten në pagesë."],
  ["Proceed to checkout", "Vazhdo te pagesa"],
  ["Remove", "Hiq"],
  ["Checkout", "Pagesa"],
  ["Contact", "Kontakti"],
  ["Payment", "Pagesa"],
  ["Delivery", "Dorëzimi"],
  ["Address", "Adresa"],
  ["Order summary", "Përmbledhja e porosisë"],
  ["Place order", "Bëj porosinë"],
  ["Sign in to Vishu.shop", "Hyr në Vishu.shop"],
  ["Email", "Email"],
  ["Password", "Fjalëkalimi"],
  ["Login code", "Kodi i hyrjes"],
  ["Customer", "Klient"],
  ["Vendor", "Shitës"],
  ["Create account", "Krijo llogari"],
  ["First name", "Emri"],
  ["Last name", "Mbiemri"],
  ["Phone number", "Numri i telefonit"],
  ["Shop name", "Emri i dyqanit"],
  ["New Arrivals", "Produkte të reja"],
  ["New arrivals", "Produkte të reja"],
  ["Add to cart", "Shto në shportë"],
  ["Add to Cart", "Shto në shportë"],
  ["Choose size", "Zgjidh madhësinë"],
  ["Select size", "Zgjidh madhësinë"],
  ["Sold out", "E shitur"],
  ["Sold Out", "E shitur"],
  ["Go to Cart", "Shko te shporta"],
  ["Favorites", "Të preferuarat"],
  ["Open favorites", "Hap të preferuarat"],
  ["View product", "Shiko produktin"],
  ["Loading shops...", "Dyqanet po ngarkohen..."],
  ["No active shops yet.", "Ende nuk ka dyqane aktive."],
  ["Open shop", "Hap dyqanin"],
  ["Coming soon", "Së shpejti"],
  ["Back to all shops", "Kthehu te të gjitha dyqanet"],
  ["Browse products", "Shfleto produktet"],
  ["Shop reviews", "Vlerësimet e dyqanit"],
  ["Rate this shop", "Vlerëso këtë dyqan"],
  ["Review", "Vlerësimi"],
  ["Services", "Shërbime"],
  ["Policy", "Politika"],
  ["Privacy", "Privatësia"],
  ["Terms", "Kushtet"],
  ["View", "Shiko"],
  ["Open product", "Shiko"],
  ["Close", "Mbyll"],
  ["Save", "Ruaj"],
  ["Saving...", "Duke ruajtur..."],
  ["Cancel", "Anulo"],
  ["Update", "Përditëso"],
  ["Delete", "Fshi"],
  ["Edit", "Ndrysho"],
  ["Create", "Krijo"],
  ["Submit", "Dërgo"],
  ["Send", "Dërgo"],
  ["Back", "Kthehu"],
  ["Next", "Tjetër"],
  ["Previous", "I mëparshmi"],
  ["Loading...", "Duke u ngarkuar..."],
  ["Dashboard", "Paneli"],
  ["Orders", "Porositë"],
  ["Products", "Produktet"],
  ["Inventory", "Inventari"],
  ["Earnings", "Fitimet"],
  ["Settings", "Cilësimet"],
  ["Vendor workspace", "Hapësira e shitësit"],
  ["Vendor workspace", "Hapësira e shitësit"],
  ["Notifications", "Njoftime"],
  ["Vendor Panel", "Paneli i shitësit"],
  ["Product", "Produkti"],
  ["Product name", "Emri i produktit"],
  ["Product photos", "Fotot e produktit"],
  ["Description", "Përshkrimi"],
  ["Category", "Kategoria"],
  ["Department", "Departamenti"],
  ["Color", "Ngjyra"],
  ["Size", "Madhësia"],
  ["Price", "Çmimi"],
  ["Stock", "Stoku"],
  ["Status", "Statusi"],
  ["Actions", "Veprime"],
  ["Published", "Publikuar"],
  ["Draft", "Draft"],
  ["Active", "Aktiv"],
  ["Inactive", "Joaktiv"],
  ["Pending", "Në pritje"],
  ["Completed", "Përfunduar"],
  ["Cancelled", "Anuluar"],
  ["Delivered", "Dorëzuar"],
  ["Processing", "Në përpunim"],
  ["Paid", "Paguar"],
  ["Unpaid", "Pa paguar"],
  ["Order", "Porosia"],
  ["Order total", "Totali i porosisë"],
  ["Customer", "Klient"],
  ["Quantity", "Sasia"],
  ["Total", "Totali"],
  ["Refresh", "Rifresko"],
  ["Refresh orders", "Rifresko porositë"],
  ["Add product", "Shto produkt"],
  ["New product", "Produkt i ri"],
  ["Save product", "Ruaj produktin"],
  ["Update product", "Përditëso produktin"],
  ["Delete product", "Fshi produktin"],
  ["Upload", "Ngarko"],
  ["Upload image", "Ngarko imazh"],
  ["Camera", "Kamera"],
  ["Library", "Libraria"],
  ["Shop Profile", "Profili i dyqanit"],
  ["Shop profile", "Profili i dyqanit"],
  ["Shop logo", "Logo e dyqanit"],
  ["Shop cover", "Kopertina e dyqanit"],
  ["Cover image URL", "URL e imazhit të kopertinës"],
  ["Logo preview", "Parapamje e logos"],
  ["Cover preview", "Parapamje e kopertinës"],
  ["Branding status", "Statusi i markës"],
  ["Save shop profile", "Ruaj profilin e dyqanit"],
  ["Support email", "Email i mbështetjes"],
  ["Support phone", "Telefoni i mbështetjes"],
  ["Current shop state", "Gjendja aktuale e dyqanit"],
  ["Business address", "Adresa e biznesit"],
  ["Business hours", "Orari i punës"],
  ["Shipping notes", "Shënime transporti"],
  ["Return policy", "Politika e kthimit"],
  ["Low stock alert threshold", "Kufiri i alarmit për stok të ulët"],
  ["Stock alert rule", "Rregulli i alarmit të stokut"],
  ["Team Access", "Qasja e ekipit"],
  ["Role", "Roli"],
  ["Invite", "Fto"],
  ["Invite team member", "Fto anëtar ekipi"],
  ["Employee", "Punonjës"],
  ["Manager", "Menaxher"],
  ["Shop Holder", "Mbajtës dyqani"],
  ["Vendor Security", "Siguria e shitësit"],
  ["Current password", "Fjalëkalimi aktual"],
  ["New password", "Fjalëkalimi i ri"],
  ["Change password", "Ndrysho fjalëkalimin"],
  ["Save account details", "Ruaj të dhënat e llogarisë"],
  ["Account Details", "Të dhënat e llogarisë"],
  ["Full name", "Emri i plotë"],
  ["Address line", "Rreshti i adresës"],
  ["City", "Qyteti"],
  ["Country", "Shteti"],
  ["Postal code", "Kodi postar"],
  ["Save address", "Ruaj adresën"],
  ["Use this address", "Përdor këtë adresë"],
  ["Change address", "Ndrysho adresën"],
  ["Payment method", "Mënyra e pagesës"],
  ["Cash on delivery", "Pagesë në dorëzim"],
  ["Card payment", "Pagesë me kartë"],
  ["Stripe checkout", "Pagesë me Stripe"],
  ["Checkout failed.", "Pagesa dështoi."],
  ["Order placed", "Porosia u krye"],
  ["Orders history", "Historiku i porosive"],
  ["My orders", "Porositë e mia"],
  ["Returns", "Kthimet"],
  ["Support", "Mbështetje"],
  ["Favorites", "Të preferuarat"],
  ["Profile", "Profili"],
  ["Security", "Siguria"],
  ["Preferences", "Preferencat"],
  ["Search products", "Kërko produkte"],
  ["Search orders", "Kërko porosi"],
  ["Filter", "Filtro"],
  ["Filters", "Filtrat"],
  ["Sort", "Rendit"],
  ["Newest", "Më të rejat"],
  ["Clear filters", "Pastro filtrat"],
  ["All", "Të gjitha"],
  ["All styles", "Të gjitha stilet"],
  ["categories", "kategori"],
  ["items", "produkte"],
  ["available now", "në dispozicion tani"],
  ["Currently unavailable", "Aktualisht jo në dispozicion"],
  ["Marketplace listing", "Listim në treg"],
  ["Open this shop to see its current marketplace catalog.", "Hap këtë dyqan për të parë katalogun aktual në treg."],
  ["Overview", "Përmbledhje"],
  ["Seller dashboard", "Paneli i shitësit"],
  ["Track today’s store health, pending work, revenue, low-stock alerts, and recent activity.", "Ndiq gjendjen e sotme të dyqanit, punët në pritje, të ardhurat, alarmet për stok të ulët dhe aktivitetin e fundit."],
  ["Catalog", "Katalogu"],
  ["Create, edit, search, filter, duplicate, and manage your live catalog from one focused product workspace.", "Krijo, ndrysho, kërko, filtro, kopjo dhe menaxho katalogun live nga një hapësirë e vetme produktesh."],
  ["Stock", "Stoku"],
  ["Review low-stock products, update quantities, and run bulk stock actions without mixing in order work.", "Kontrollo produktet me stok të ulët, përditëso sasitë dhe bëj veprime masive pa i përzier me porositë."],
  ["Fulfillment", "Përmbushja"],
  ["Handle pending, shipped, completed, cancelled, and returned orders in one structured fulfillment view.", "Menaxho porositë në pritje, të dërguara, të përfunduara, të anuluara dhe të kthyera në një pamje të strukturuar."],
  ["Finance", "Financa"],
  ["See revenue, payout summary, recent earnings, and top-selling products in one clean seller view.", "Shiko të ardhurat, përmbledhjen e pagesave, fitimet e fundit dhe produktet më të shitura në një pamje të pastër."],
  ["Failed to load vendor workspace.", "Hapësira e shitësit nuk mund të ngarkohej."],
  ["Product updated.", "Produkti u përditësua."],
  ["Product created.", "Produkti u krijua."],
  ["Unable to save product.", "Produkti nuk mund të ruhej."],
  ["Unable to submit catalog request.", "Kërkesa e katalogut nuk mund të dërgohej."],
  ["Delete this product from your catalog?", "Ta fshij këtë produkt nga katalogu?"],
  ["Delete failed.", "Fshirja dështoi."],
  ["Duplicate failed.", "Kopjimi dështoi."],
  ["Status update failed.", "Përditësimi i statusit dështoi."],
  ["Cancel this order and notify the customer?", "Ta anuloj këtë porosi dhe të njoftoj klientin?"],
  ["Approve the customer's cancellation request and notify them?", "Aprovo kërkesën e klientit për anulim dhe njoftoje?"],
  ["Cash collected", "Pagesa cash u mblodh"],
  ["Cash on delivery", "Pagesë në dorëzim"],
  ["Customer contact", "Kontakti i klientit"],
  ["Phone not provided", "Telefoni nuk është dhënë"],
  ["Delivery:", "Dorëzimi:"],
  ["Customer note:", "Shënim i klientit:"],
  ["Call customer", "Telefono klientin"],
  ["Reply by email", "Përgjigju me email"],
  ["No direct contact saved.", "Nuk ka kontakt direkt të ruajtur."],
  ["Customer requested cancellation. Do not ship this order; contact the customer or admin before continuing.", "Klienti ka kërkuar anulim. Mos e dërgo këtë porosi; kontakto klientin ose adminin para se të vazhdosh."],
  ["Product photos", "Fotot e produktit"],
  ["Replace existing images", "Zëvendëso imazhet ekzistuese"],
  ["Images", "Imazhet"],
  ["Brand", "Marka"],
  ["No brand", "Pa markë"],
  ["Accessory type", "Lloji i aksesorit"],
  ["Accessory", "Aksesor"],
  ["Hat", "Kapele"],
  ["Hats", "Kapele"],
  ["Belt", "Rrip"],
  ["Belts", "Rripa"],
  ["Tie", "Kravatë"],
  ["Ties", "Kravata"],
  ["Scarf", "Shall"],
  ["Scarves", "Shalle"],
  ["Wallet", "Kuletë"],
  ["Wallets", "Kuleta"],
  ["Glasses", "Syze"],
  ["Brooch", "Broshë"],
  ["Brooches", "Brosha"],
  ["Bag", "Çantë"],
  ["Bags", "Çanta"],
  ["Jewelry", "Bizhuteri"],
  ["Not required", "Nuk kërkohet"],
  ["Subcategory", "Nënkategoria"],
  ["Gender", "Gjinia"],
  ["Size type", "Lloji i madhësisë"],
  ["Choose size details", "Zgjidh detajet e madhësisë"],
  ["Select size type", "Zgjidh llojin e madhësisë"],
  ["Select brand", "Zgjidh markën"],
  ["Select category", "Zgjidh kategorinë"],
  ["Select subcategory", "Zgjidh nënkategorinë"],
  ["Select gender", "Zgjidh gjininë"],
  ["Create product", "Krijo produkt"],
  ["Edit product", "Ndrysho produktin"],
  ["Duplicate", "Kopjo"],
  ["Publish", "Publiko"],
  ["Unpublish", "Hiq nga publikimi"],
  ["In stock", "Në stok"],
  ["Low stock", "Stok i ulët"],
  ["Out of stock", "Jashtë stoku"],
  ["All stock", "I gjithë stoku"],
  ["All listings", "Të gjitha listimet"],
  ["Listed", "Të listuara"],
  ["Unlisted", "Të palistuara"],
  ["Bulk stock", "Stok masiv"],
  ["Apply", "Apliko"],
  ["Recent activity", "Aktiviteti i fundit"],
  ["Recent orders", "Porositë e fundit"],
  ["Recent earnings", "Fitimet e fundit"],
  ["Top-selling products", "Produktet më të shitura"],
  ["Sales data will appear here once orders start coming in.", "Të dhënat e shitjeve do të shfaqen kur të fillojnë porositë."],
  ["No earnings activity yet.", "Ende nuk ka aktivitet fitimesh."],
  ["Total vendor earnings", "Fitimet totale të shitësit"],
  ["Net earnings tracked across all vendor order items.", "Fitimet neto të ndjekura në të gjitha produktet e porosive."],
  ["Completed orders", "Porositë e përfunduara"],
  ["Delivered orders contributing to your performance.", "Porositë e dorëzuara që ndikojnë në performancën tuaj."],
  ["Units sold", "Njësi të shitura"],
  ["Total sold units across your active catalog.", "Njësitë totale të shitura në katalogun aktiv."],
  ["Cancelled / returned", "Të anuluara / të kthyera"],
  ["Orders that did not finish the normal delivery flow.", "Porositë që nuk përfunduan rrjedhën normale të dorëzimit."],
  ["Needs response", "Kërkon përgjigje"],
  ["All orders", "Të gjitha porositë"],
  ["Pending response", "Përgjigje në pritje"],
  ["Mark shipped", "Shëno si të dërguar"],
  ["Mark delivered", "Shëno si të dorëzuar"],
  ["Print label", "Printo etiketën"],
  ["Download label", "Shkarko etiketën"],
  ["Cancel order", "Anulo porosinë"],
  ["Delivery label", "Etiketa e dorëzimit"],
  ["Shipping address", "Adresa e transportit"],
  ["No pending work.", "Nuk ka punë në pritje."],
  ["No products found.", "Nuk u gjetën produkte."],
  ["No orders found.", "Nuk u gjetën porosi."],
  ["No logo uploaded yet", "Ende nuk është ngarkuar logo"],
  ["No cover image yet", "Ende nuk ka imazh kopertine"],
  ["Logo image stored", "Logoja është ruajtur"],
  ["Cover image stored", "Kopertina është ruajtur"],
  ["Upload a logo image instead of typing a link.", "Ngarko një logo në vend që të shkruash një link."],
  ["Upload a cover image shown behind your shop card and shop profile.", "Ngarko një kopertinë që shfaqet pas kartës dhe profilit të dyqanit."],
  ["Invite Shop Holders, Managers, or Employees, review active access, and manage pending invites for this shop.", "Fto mbajtës dyqani, menaxherë ose punonjës, kontrollo qasjen aktive dhe menaxho ftesat në pritje."],
  ["Invite member", "Fto anëtar"],
  ["Sending...", "Duke dërguar..."],
  ["Pending invites", "Ftesa në pritje"],
  ["Resend", "Ridërgo"],
  ["Remove access", "Hiq qasjen"],
  ["Only a Shop Holder or Manager can manage vendor settings.", "Vetëm mbajtësi i dyqanit ose menaxheri mund të menaxhojë cilësimet e shitësit."],
  ["Settings access is limited", "Qasja te cilësimet është e kufizuar"],
  ["Employees can manage products, inventory, and orders, but only a Shop Holder or Manager can open shop settings, finance, or team access.", "Punonjësit mund të menaxhojnë produkte, inventar dhe porosi, por vetëm mbajtësi i dyqanit ose menaxheri mund të hapë cilësimet, financat ose qasjen e ekipit."],
  ["Finance access is limited", "Qasja te financat është e kufizuar"],
  ["Only a Shop Holder or Manager can open earnings, payouts, and revenue performance.", "Vetëm mbajtësi i dyqanit ose menaxheri mund të hapë fitimet, pagesat dhe performancën e të ardhurave."],
  ["Only a Shop Holder or Manager can view earnings.", "Vetëm mbajtësi i dyqanit ose menaxheri mund të shikojë fitimet."],
  ["Only Shop Holders can change this access.", "Vetëm mbajtësit e dyqanit mund ta ndryshojnë këtë qasje."],
  ["Shop Holder only", "Vetëm mbajtësi i dyqanit"],
  ["Vendor Settings", "Cilësimet e shitësit"],
  ["Your Shop", "Dyqani juaj"],
  ["Your Shop Settings", "Cilësimet e dyqanit tuaj"],
  ["Manage vendor profile and shop settings.", "Menaxho profilin e shitësit dhe cilësimet e dyqanit."],
  ["Sign out", "Dil"],
  ["Admin Login", "Hyrje Admin"],
  ["No orders or stock alerts need your response.", "Asnjë porosi ose alarm stoku nuk kërkon përgjigjen tuaj."],
  ["View all orders", "Shiko të gjitha porositë"],
  ["View products", "Shiko produktet"],
  ["No items added yet", "Ende nuk ka produkte"],
  ["Add products to review them here before checkout.", "Shtoni produkte për t'i parë këtu para pagesës."],
  ["No saved products yet", "Ende nuk ka produkte të ruajtura"],
  ["No favorites yet.", "Ende pa të preferuara."],
  ["Use the star on product cards to build a quick watch list.", "Përdorni yllin te kartat e produkteve për të krijuar listën."],
  ["Marketplace support, policy, and service information.", "Mbështetje, politika dhe informacion shërbimi për tregun."],
  ["Secure marketplace operations", "Operacione të sigurta të tregut"],
  ["Platform control, approvals, and growth", "Kontroll platforme, miratime dhe rritje"],
  ["Open favorites watch list", "Hap listën e të preferuarave"],
  ["Favorite products watch list", "Lista e produkteve të preferuara"],
  ["Choose language", "Zgjidh gjuhën"],
  ["Choose vendor or shopping mode", "Zgjidh modalitetin e shitësit ose blerjes"],
  ["Stock alert", "Alarm stoku"],
  ["Cancel requested", "Anulim i kërkuar"],
  ["New order", "Porosi e re"],
  ["Orders", "Porositë"],
  ["Account summary and recent activity", "Përmbledhje e llogarisë dhe aktiviteti i fundit"],
  ["Review your recent purchases", "Shikoni blerjet tuaja të fundit"],
  ["Manage product returns and exchanges", "Menaxhoni kthimet dhe ndërrimet e produkteve"],
  ["Reviews", "Vlerësime"],
  ["Rate delivered products and revisit feedback", "Vlerësoni produktet e dorëzuara dhe rishikoni komentet"],
  ["Saved products you want to revisit", "Produkte të ruajtura që dëshironi t'i rishikoni"],
  ["Order and account updates", "Përditësime të porosive dhe llogarisë"],
  ["Addresses", "Adresat"],
  ["Manage saved delivery destinations", "Menaxhoni destinacionet e ruajtura të dorëzimit"],
  ["Payments", "Pagesat"],
  ["Stripe-managed cards and defaults", "Kartat dhe parazgjedhjet e menaxhuara nga Stripe"],
  ["Get help with orders, delivery, and account questions", "Merrni ndihmë për porositë, dorëzimin dhe pyetjet e llogarisë"],
  ["Security, preferences, and recovery", "Siguria, preferencat dhe rikuperimi"],
  ["Not available", "Nuk është e disponueshme"],
  ["Unknown", "E panjohur"],
  ["COD collected", "Pagesa në dorëzim u mblodh"],
  ["COD refused", "Pagesa në dorëzim u refuzua"],
  ["COD on delivery", "Pagesë në dorëzim"],
  ["Card paid", "Paguar me kartë"],
  ["Your cancellation request is waiting for the vendor. The order stays active until they cancel it or continue fulfillment.", "Kërkesa juaj për anulim është në pritje të shitësit. Porosia mbetet aktive derisa shitësi ta anulojë ose ta vazhdojë përmbushjen."],
  ["The vendor confirmed this order. You can still request cancellation until it is delivered.", "Shitësi e konfirmoi këtë porosi. Mund të kërkoni anulim derisa porosia të dorëzohet."],
  ["This order is on the way. You can still request cancellation until it is marked delivered.", "Kjo porosi është në rrugë. Mund të kërkoni anulim derisa të shënohet si e dorëzuar."],
  ["You can request cancellation until the order is delivered.", "Mund të kërkoni anulim derisa porosia të dorëzohet."],
  ["Choose the delivered product you want to return.", "Zgjidhni produktin e dorëzuar që dëshironi të ktheni."],
  ["This order cannot be cancelled or returned from this panel right now.", "Kjo porosi nuk mund të anulohet ose kthehet nga ky panel për momentin."],
  ["Placed", "Vendosur"],
  ["Preparing", "Në përgatitje"],
  ["Shipped", "Dërguar"],
  ["Delivery address not saved", "Adresa e dorëzimit nuk është ruajtur"],
  ["Pending verification", "Verifikim në pritje"],
  ["Email verified", "Emaili u verifikua"],
  ["Verified", "Verifikuar"],
  ["Verification pending", "Verifikim në pritje"],
  ["Failed to load your account.", "Llogaria juaj nuk mund të ngarkohej."],
  ["Your card was added through Stripe and is now available for checkout.", "Karta juaj u shtua përmes Stripe dhe tani është e disponueshme për pagesë."],
  ["Card setup was cancelled. No payment method was saved.", "Konfigurimi i kartës u anulua. Nuk u ruajt asnjë mënyrë pagese."],
  ["Home", "Kryefaqja"],
  ["Read", "Lexuar"],
  ["Alert", "Alarm"],
  ["Help", "Ndihmë"],
  ["Return request saved for review.", "Kërkesa e kthimit u ruajt për shqyrtim."],
  ["Return request failed.", "Kërkesa e kthimit dështoi."],
  ["Support request opened.", "Kërkesa për mbështetje u hap."],
  ["Support request failed.", "Kërkesa për mbështetje dështoi."],
  ["Cancel request sent.", "Kërkesa për anulim u dërgua."],
  ["Cancel request failed.", "Kërkesa për anulim dështoi."],
  ["Please choose a delivered product to return.", "Ju lutemi zgjidhni një produkt të dorëzuar për kthim."],
  ["Customer requested return from order details", "Klienti kërkoi kthim nga detajet e porosisë"],
  ["Please complete the required address details before saving.", "Ju lutemi plotësoni të dhënat e kërkuara të adresës para ruajtjes."],
  ["Address saved.", "Adresa u ruajt."],
  ["Address updated.", "Adresa u përditësua."],
  ["Address save failed.", "Ruajtja e adresës dështoi."],
  ["Delete this saved address?", "Ta fshij këtë adresë të ruajtur?"],
  ["Address removed.", "Adresa u hoq."],
  ["Address delete failed.", "Fshirja e adresës dështoi."],
  ["Default delivery address updated.", "Adresa e parazgjedhur e dorëzimit u përditësua."],
  ["Could not update default address.", "Adresa e parazgjedhur nuk mund të përditësohej."],
  ["Default payment method updated.", "Mënyra e parazgjedhur e pagesës u përditësua."],
  ["Could not update the default payment method.", "Mënyra e parazgjedhur e pagesës nuk mund të përditësohej."],
  ["Remove this saved card from your account?", "Ta hiqni këtë kartë të ruajtur nga llogaria juaj?"],
  ["Saved card removed.", "Karta e ruajtur u hoq."],
  ["Could not remove that saved card.", "Karta e ruajtur nuk mund të hiqej."],
  ["Email preferences saved.", "Preferencat e emailit u ruajtën."],
  ["Could not save your preferences.", "Preferencat tuaja nuk mund të ruheshin."],
  ["Email is required.", "Emaili është i detyrueshëm."],
  ["Pending email change cancelled.", "Ndryshimi i emailit në pritje u anulua."],
  ["Account details updated.", "Të dhënat e llogarisë u përditësuan."],
  ["Could not update your account details.", "Të dhënat e llogarisë nuk mund të përditësoheshin."],
  ["Enter the 6-digit code from your email.", "Shkruani kodin 6-shifror nga emaili juaj."],
  ["Your new email address is now verified and active.", "Adresa juaj e re e emailit tani është verifikuar dhe aktive."],
  ["Could not verify your new email address.", "Adresa juaj e re e emailit nuk mund të verifikohej."],
  ["Could not resend the code.", "Kodi nuk mund të ridërgohej."],
  ["Please enter your current and new password.", "Ju lutemi shkruani fjalëkalimin aktual dhe të ri."],
  ["Your new password confirmation does not match.", "Konfirmimi i fjalëkalimit të ri nuk përputhet."],
  ["Password updated.", "Fjalëkalimi u përditësua."],
  ["Could not update your password.", "Fjalëkalimi nuk mund të përditësohej."],
  ["No order activity yet", "Ende nuk ka aktivitet porosish"],
  ["Place your first order to start delivery and review activity here.", "Bëni porosinë e parë për të nisur dorëzimin dhe vlerësimet këtu."],
  ["Not added yet", "Ende nuk është shtuar"],
  ["Not added", "Nuk është shtuar"],
  ["No default address saved yet", "Ende nuk ka adresë të parazgjedhur të ruajtur"],
  ["No saved Stripe card yet", "Ende nuk ka kartë Stripe të ruajtur"],
  ["Start saving products you want to revisit", "Filloni të ruani produktet që dëshironi t'i rishikoni"],
  ["Waiting for first order", "Në pritje të porosisë së parë"],
  ["Add one", "Shto një"],
  ["Not set", "Nuk është caktuar"],
  ["Order progress", "Ecuria e porosisë"],
  ["Waiting", "Në pritje"],
  ["Card", "Kartë"],
  ["Cash is collected when the order is delivered.", "Pagesa merret kur porosia dorëzohet."],
  ["Payment details are attached to this order.", "Detajet e pagesës janë të lidhura me këtë porosi."],
  ["Request cancel", "Kërko anulim"],
  ["Request return", "Kërko kthim"],
  ["Hide details", "Fshih detajet"],
  ["View details", "Shiko detajet"],
  ["No guest order matches waiting right now", "Nuk ka porosi mysafiri në pritje për momentin"],
  ["Opening...", "Duke hapur..."],
  ["Open request", "Hap kërkesën"],
  ["Make default", "Bëje parazgjedhje"],
  ["Removing...", "Duke hequr..."],
  ["Cardholder name from Stripe", "Emri i mbajtësit të kartës nga Stripe"],
  ["Set default", "Cakto si parazgjedhje"],
  ["Optional phone number", "Numër telefoni opsional"],
  ["Save settings", "Ruaj cilësimet"],
  ["Save preferences", "Ruaj preferencat"],
  ["Updating...", "Duke përditësuar..."],
  ["Update password", "Përditëso fjalëkalimin"],
  ["Loading account...", "Llogaria po ngarkohet..."],
  ["Account sections", "Seksionet e llogarisë"],
  ["Add one for faster checkout", "Shto një për pagesë më të shpejtë"],
  ["Add a new address", "Shto adresë të re"],
  ["Edit address", "Ndrysho adresën"],
  ["Update address", "Përditëso adresën"],
  ["Verifying...", "Duke verifikuar..."],
  ["Verify email", "Verifiko emailin"],
  ["Resend code", "Ridërgo kodin"],
  ["Confirm", "Konfirmo"],
  ["Guest checkout", "Blerje si mysafir"],
  ["Paid online", "Paguar online"],
  ["VISHU DELIVERY LABEL", "ETIKETA E DORËZIMIT VISHU"],
  ["DELIVER TO", "DORËZO TE"],
  ["PACKAGE ITEMS", "PRODUKTET E PAKOS"],
  ["Could not load label image.", "Imazhi i etiketës nuk mund të ngarkohej."],
  ["Could not read label image.", "Imazhi i etiketës nuk mund të lexohej."],
  ["Product deleted.", "Produkti u fshi."],
  ["Product is visible in the shop.", "Produkti është i dukshëm në dyqan."],
  ["Product hidden from the public shop.", "Produkti u fsheh nga dyqani publik."],
  ["Listing update failed.", "Përditësimi i listimit dështoi."],
  ["Product duplicated.", "Produkti u kopjua."],
  ["Bulk stock updated.", "Stoku masiv u përditësua."],
  ["Bulk stock update failed.", "Përditësimi masiv i stokut dështoi."],
  ["Order status updated.", "Statusi i porosisë u përditësua."],
  ["Order cancelled and customer notified.", "Porosia u anulua dhe klienti u njoftua."],
  ["Order cancellation failed.", "Anulimi i porosisë dështoi."],
  ["Customer cancellation approved and customer notified.", "Anulimi i kërkuar nga klienti u aprovua dhe klienti u njoftua."],
  ["Customer cancellation approval failed.", "Aprovimi i anulimit të klientit dështoi."],
  ["Could not open print window. Allow popups and try again.", "Dritarja e printimit nuk mund të hapej. Lejoni popup-et dhe provoni përsëri."],
  ["Could not create delivery label PDF.", "PDF-ja e etiketës së dorëzimit nuk mund të krijohej."],
  ["No activity recorded", "Nuk ka aktivitet të regjistruar"],
  ["Collect on arrival", "Mblidh pagesën në dorëzim"],
  ["Delivery refused", "Dorëzimi u refuzua"],
  ["Already paid", "Tashmë e paguar"],
  ["Restock now", "Rimbushe tani"],
  ["Refine this product", "Përmirëso këtë produkt"],
  ["Create a sharper listing", "Krijo një listim më të qartë"],
  ["Editing", "Duke ndryshuar"],
  ["New listing", "Listim i ri"],
  ["No images yet", "Ende pa imazhe"],
  ["Ex. Soft lounge hoodie", "P.sh. Hoodie i butë për përditshmëri"],
  ["Total stock", "Stoku total"],
  ["Product genders", "Gjinitë e produktit"],
  ["Assigned from the chosen category", "Caktuar nga kategoria e zgjedhur"],
  ["Product colors", "Ngjyrat e produktit"],
  ["Sizes", "Madhësitë"],
  ["Product sizes", "Madhësitë e produktit"],
  ["Choose brand", "Zgjidh markën"],
  ["Choose category", "Zgjidh kategorinë"],
  ["Optional", "Opsionale"],
  ["Choose product images", "Zgjidh imazhet e produktit"],
  ["Current image", "Imazhi aktual"],
  ["Creating...", "Duke krijuar..."],
  ["Enter the missing option", "Shkruani opsionin që mungon"],
  ["Optional context for admin", "Kontekst opsional për administratorin"],
  ["Submitting...", "Duke dërguar..."],
  ["Submit request", "Dërgo kërkesën"],
  ["Missing", "Mungesë"],
  ["Missing value", "Vlera që mungon"],
  ["Request a missing catalog option from admin.", "Kërko nga administratori një opsion që mungon në katalog."],
  ["Enter what is missing", "Shkruaj çfarë mungon"],
  ["No products yet. Add your first product to start building the shop.", "Ende nuk ka produkte. Shtoni produktin e parë për të nisur ndërtimin e dyqanit."],
  ["No matching products yet.", "Ende nuk ka produkte që përputhen."],
  ["Code pending", "Kodi në pritje"],
  ["Hidden", "Fshehur"],
  ["Healthy stock", "Stok i shëndetshëm"],
  ["Public listing active", "Listimi publik është aktiv"],
  ["Hidden from customers", "Fshehur nga klientët"],
  ["Duplicating...", "Duke kopjuar..."],
  ["Hide", "Fshih"],
  ["Show", "Shfaq"],
  ["Deleting...", "Duke fshirë..."],
  ["Apply stock update", "Apliko përditësimin e stokut"],
  ["Configuration", "Konfigurimi"],
  ["Manage shop information, working hours, low-stock alerts, and seller account configuration.", "Menaxhoni informacionin e dyqanit, orarin e punës, alarmet e stokut të ulët dhe konfigurimin e llogarisë së shitësit."],
  ["Resend verification email", "Ridërgo emailin e verifikimit"],
  ["First name and last name are required.", "Emri dhe mbiemri janë të detyrueshëm."],
  ["Vendor profile updated. Verify your new email before your next sign in.", "Profili i shitësit u përditësua. Verifikoni emailin e ri para hyrjes së radhës."],
  ["Vendor profile updated.", "Profili i shitësit u përditësua."],
  ["Failed to update vendor profile.", "Profili i shitësit nuk mund të përditësohej."],
  ["Could not resend verification email.", "Emaili i verifikimit nuk mund të ridërgohej."],
  ["Vendor shop profile updated.", "Profili i dyqanit u përditësua."],
  ["Failed to update vendor shop profile.", "Profili i dyqanit nuk mund të përditësohej."],
  ["Failed to update password.", "Fjalëkalimi nuk mund të përditësohej."],
  ["Failed to send invite.", "Ftesa nuk mund të dërgohej."],
  ["Failed to resend invite.", "Ftesa nuk mund të ridërgohej."],
  ["Failed to update role.", "Roli nuk mund të përditësohej."],
  ["Remove this person from the shop workspace?", "Ta hiqni këtë person nga hapësira e dyqanit?"],
  ["Failed to remove access.", "Qasja nuk mund të hiqej."],
  ["Restricted", "E kufizuar"],
  ["No shop name yet", "Ende nuk ka emër dyqani"],
  ["No support email", "Nuk ka email mbështetjeje"],
  ["No support phone", "Nuk ka telefon mbështetjeje"],
  ["Vendor logo preview", "Parapamje e logos së shitësit"],
  ["Vendor cover preview", "Parapamje e kopertinës së shitësit"],
  ["Optional internal note", "Shënim i brendshëm opsional"],
  ["Enter 6-digit code", "Shkruani kodin 6-shifror"],
  ["Checking code...", "Duke kontrolluar kodin..."],
  ["Customers can place orders, vendors can manage their products, and admins can approve shops and oversee the whole platform.", "Klientët mund të bëjnë porosi, shitësit mund të menaxhojnë produktet e tyre dhe administratorët mund të miratojnë dyqanet dhe të mbikëqyrin të gjithë platformën."],
  ["Reset password", "Rivendos fjalëkalimin"],
  ["Logged in successfully.", "Hyrja u krye me sukses."],
  ["Enter your email first.", "Shkruani fillimisht emailin tuaj."],
  ["Join as", "Bashkohu si"],
  ["Shop and place orders", "Bli dhe bëj porosi"],
  ["Open a shop and sell", "Hap dyqan dhe shit"],
  ["Confirm password", "Konfirmo fjalëkalimin"],
  ["Marketplace Policy", "Politika e tregut"],
  ["Terms of Service", "Kushtet e shërbimit"],
  ["Passwords do not match.", "Fjalëkalimet nuk përputhen."],
  ["Vendors must accept Vishu terms, marketplace policy, and refund policy.", "Shitësit duhet të pranojnë kushtet e Vishu, politikën e tregut dhe politikën e rimbursimit."],
  ["Registration failed.", "Regjistrimi dështoi."],
  ["Open your shop in minutes.", "Hapni dyqanin tuaj brenda pak minutash."],
  ["Join the storefront in minutes.", "Bashkohuni me dyqanin online brenda pak minutash."],
  ["Redirecting to registration...", "Duke ju drejtuar te regjistrimi..."],
  ["Missing verification token.", "Mungon tokeni i verifikimit."],
  ["Redirecting to login...", "Duke ju drejtuar te hyrja..."],
  ["Loading verification...", "Verifikimi po ngarkohet..."],
  ["Verification failed.", "Verifikimi dështoi."],
  ["Missing email address for verification.", "Mungon adresa e emailit për verifikim."],
  ["Verification code", "Kodi i verifikimit"],
  ["Verifying your account...", "Llogaria juaj po verifikohet..."],
  ["Enter the 6-digit verification code.", "Shkruani kodin 6-shifror të verifikimit."],
  ["Could not resend the verification code.", "Kodi i verifikimit nuk mund të ridërgohej."],
  ["Enter the 6-digit code we sent to your email address within 10 minutes to finish creating your account.", "Shkruani brenda 10 minutash kodin 6-shifror që dërguam në emailin tuaj për të përfunduar krijimin e llogarisë."],
  ["Confirm new password", "Konfirmo fjalëkalimin e ri"],
  ["The two passwords do not match.", "Dy fjalëkalimet nuk përputhen."],
  ["Continue to reset password", "Vazhdo te rivendosja e fjalëkalimit"],
  ["Opening your account...", "Llogaria juaj po hapet..."],
  ["Redirecting to shop...", "Duke ju drejtuar te dyqani..."],
  ["Loading reset flow...", "Rrjedha e rivendosjes po ngarkohet..."],
  ["Reset request failed.", "Kërkesa për rivendosje dështoi."],
  ["The two password fields do not match.", "Dy fushat e fjalëkalimit nuk përputhen."],
  ["Password reset failed.", "Rivendosja e fjalëkalimit dështoi."],
  ["Send reset email", "Dërgo emailin e rivendosjes"],
  ["Password updated successfully.", "Fjalëkalimi u përditësua me sukses."],
  ["Sign in later", "Hyr më vonë"],
  ["View my orders", "Shiko porositë e mia"],
  ["Save this address for next time?", "Ta ruaj këtë adresë për herën tjetër?"],
  ["Sign in", "Hyr"],
  ["Delivery details", "Detajet e dorëzimit"],
  ["Add new address", "Shto adresë të re"],
  ["Apartment or delivery note", "Apartament ose shënim dorëzimi"],
  ["No payment methods are enabled right now.", "Asnjë mënyrë pagese nuk është aktive për momentin."],
  ["Loading saved details...", "Të dhënat e ruajtura po ngarkohen..."],
  ["Back to cart", "Kthehu te shporta"],
  ["Confirm cash on delivery order?", "Ta konfirmosh porosinë me pagesë në dorëzim?"],
  ["Failed to load payment settings.", "Cilësimet e pagesës nuk mund të ngarkoheshin."],
  ["Confirming your sign-in before completing payment...", "Po konfirmojmë hyrjen tuaj para përfundimit të pagesës..."],
  ["Could not confirm Stripe payment.", "Pagesa Stripe nuk mund të konfirmohej."],
  ["Default delivery", "Dorëzimi i parazgjedhur"],
  ["Saved delivery", "Dorëzim i ruajtur"],
  ["Local marketplace", "Treg lokal"],
  ["Failed to save address.", "Adresa nuk mund të ruhej."],
  ["Please complete the contact and delivery details first.", "Ju lutemi plotësoni fillimisht të dhënat e kontaktit dhe dorëzimit."],
  ["Cash on delivery is not available right now.", "Pagesa në dorëzim nuk është e disponueshme për momentin."],
  ["Taking you back to Vishu...", "Po ju kthejmë te Vishu..."],
  ["Save as default", "Ruaje si parazgjedhje"],
  ["Default address", "Adresa e parazgjedhur"],
  ["Street and building", "Rruga dhe ndërtesa"],
  ["Apartment, floor, or local delivery note", "Apartament, kati ose shënim lokal dorëzimi"],
  ["Optional delivery or packaging note", "Shënim opsional për dorëzim ose paketim"],
  ["Placing order...", "Porosia po vendoset..."],
  ["Total items", "Totali i artikujve"],
  ["Delivery city", "Qyteti i dorëzimit"],
  ["Total paid", "Totali i paguar"],
  ["Delivery address", "Adresa e dorëzimit"],
  ["Cancel note", "Shënim anulimi"],
  ["No orders yet.", "Ende nuk ka porosi."],
  ["Active orders", "Porosi aktive"],
  ["Past orders", "Porosi të kaluara"],
  ["Failed to load orders.", "Porositë nuk mund të ngarkoheshin."],
  ["Reorder failed.", "Ribërja e porosisë dështoi."],
  ["Optional note", "Shënim opsional"],
  ["Adding...", "Duke shtuar..."],
  ["Orders, returns, saved pieces, cards, and delivery details arranged in one sharper workspace.", "Porositë, kthimet, produktet e ruajtura, kartat dhe detajet e dorëzimit të organizuara në një hapësirë më të qartë."],
  ["Member since", "Anëtar që nga"],
  ["Cart ready", "Shporta gati"],
  ["Review recent orders", "Shiko porositë e fundit"],
  ["Open reviews", "Hap vlerësimet"],
  ["Active orders", "Porosi aktive"],
  ["Ready for review", "Gati për vlerësim"],
  ["Default payment", "Pagesa e parazgjedhur"],
  ["Total purchases connected to this account.", "Totali i blerjeve të lidhura me këtë llogari."],
  ["Returns window", "Dritarja e kthimeve"],
  ["Delivered orders that can be reviewed or raised with support.", "Porosi të dorëzuara që mund të vlerësohen ose të hapen me mbështetjen."],
  ["Saved addresses", "Adresat e ruajtura"],
  ["Ready for faster delivery on your next checkout.", "Gati për dorëzim më të shpejtë në pagesën tjetër."],
  ["Products you saved for a faster return later.", "Produkte të ruajtura për t'u rikthyer më shpejt më vonë."],
  ["The details that make your next purchase feel immediate.", "Detajet që e bëjnë blerjen tjetër më të shpejtë."],
  ["Favorites moodboard", "Paneli i të preferuarave"],
  ["Manage addresses", "Menaxho adresat"],
  ["Review saved cards", "Shiko kartat e ruajtura"],
  ["Email verification", "Verifikimi i emailit"],
  ["Saved destinations", "Destinacione të ruajtura"],
  ["Saved cards", "Kartat e ruajtura"],
  ["Open full orders", "Hap porositë e plota"],
  ["Available action", "Veprim i disponueshëm"],
  ["Track your recent purchases", "Ndiq blerjet e fundit"],
  ["View full history", "Shiko historikun e plotë"],
  ["You have not placed any orders yet.", "Ende nuk keni bërë asnjë porosi."],
  ["Return-ready orders in one place", "Porositë gati për kthim në një vend"],
  ["Delivered items are gathered here so customers can quickly check what arrived, open the order, and reach support when something needs attention.", "Produktet e dorëzuara mblidhen këtu që klientët të kontrollojnë shpejt çfarë ka ardhur, të hapin porosinë dhe të kontaktojnë mbështetjen kur duhet."],
  ["Start a return request", "Nis kërkesë kthimi"],
  ["Recent return requests", "Kërkesat e fundit të kthimit"],
  ["No return requests have been opened yet.", "Ende nuk është hapur asnjë kërkesë kthimi."],
  ["No delivered orders yet. Returns will appear here after delivery.", "Ende nuk ka porosi të dorëzuara. Kthimet do të shfaqen këtu pas dorëzimit."],
  ["Contact support", "Kontakto mbështetjen"],
  ["Mark read", "Shëno si lexuar"],
  ["Delivered items ready for feedback", "Produktet e dorëzuara gati për koment"],
  ["No delivered items are waiting for a review yet. Come back after your next delivery.", "Ende nuk ka produkte të dorëzuara në pritje të vlerësimit. Kthehuni pas dorëzimit të radhës."],
  ["Fast support routes", "Rrugë të shpejta mbështetjeje"],
  ["Track delivery, check status, or inspect a recent purchase in full.", "Ndiq dorëzimin, kontrollo statusin ose shiko të plotë një blerje të fundit."],
  ["Claim guest orders", "Lidh porositë si mysafir"],
  ["Returns questions", "Pyetje për kthimet"],
  ["Delivered orders can be reviewed with support if something arrived wrong.", "Porositë e dorëzuara mund të shqyrtohen me mbështetjen nëse diçka ka ardhur gabim."],
  ["Open orders", "Hap porositë"],
  ["Review-ready items", "Produkte gati për vlerësim"],
  ["Open support request", "Hap kërkesë mbështetjeje"],
  ["Recent requests", "Kërkesat e fundit"],
  ["No support requests have been opened yet.", "Ende nuk është hapur asnjë kërkesë mbështetjeje."],
  ["Saved products worth revisiting", "Produkte të ruajtura që ia vlen të rishikohen"],
  ["Keep delivery details tidy", "Mbaji të rregullta detajet e dorëzimit"],
  ["Add address", "Shto adresë"],
  ["No saved addresses yet. Add your first delivery address.", "Ende nuk ka adresa të ruajtura. Shtoni adresën e parë të dorëzimit."],
  ["Saved payment methods", "Mënyrat e ruajtura të pagesës"],
  ["Profile details", "Detajet e profilit"],
  ["Email address", "Adresa e emailit"],
  ["Pending new email", "Email i ri në pritje"],
  ["Enter OTP code", "Shkruani kodin OTP"],
  ["Email preferences", "Preferencat e emailit"],
  ["Delivery, confirmation, and payment-related emails.", "Email për dorëzim, konfirmim dhe pagesa."],
  ["Marketing emails", "Email marketingu"],
  ["News, offers, and seasonal store updates.", "Lajme, oferta dhe përditësime sezonale të dyqanit."],
  ["Loading your account...", "Llogaria juaj po ngarkohet..."],
  ["Keep delivery details clean and reusable for faster checkout.", "Mbaji detajet e dorëzimit të pastra dhe të ripërdorshme për pagesë më të shpejtë."],
  ["Address line 1", "Adresa, rreshti 1"],
  ["Address line 2", "Adresa, rreshti 2"],
  ["State / region", "Shteti / rajoni"],
  ["Make this my default address", "Bëje adresën time të parazgjedhur"],
  ["Use this address first during future checkout.", "Përdor këtë adresë fillimisht në pagesat e ardhshme."],
  ["Enter the 6-digit code we sent to", "Shkruani kodin 6-shifror që dërguam te"],
  ["Update your seller account, shop information, branding, policies, and operating details in one place.", "Përditësoni llogarinë e shitësit, informacionin e dyqanit, markën, politikat dhe detajet operative në një vend."],
  ["Shop description", "Përshkrimi i dyqanit"],
  ["Products at or below", "Produkte në ose poshtë"],
  ["Set this to", "Caktoje në"],
  ["Refresh team", "Rifresko ekipin"],
  ["People with access", "Persona me qasje"],
  ["Primary owner", "Pronari kryesor"],
  ["Employee access", "Qasja e punonjësit"],
  ["Owner access stays fixed.", "Qasja e pronarit mbetet fikse."],
  ["Only the primary shop holder has access right now.", "Vetëm mbajtësi kryesor i dyqanit ka qasje tani."],
  ["No pending invites.", "Nuk ka ftesa në pritje."],
  ["Download PDF", "Shkarko PDF"],
  ["Orders waiting for confirmation, shipping, or a cancel decision.", "Porosi në pritje të konfirmimit, dërgimit ose vendimit për anulim."],
  ["Cancel requests stay at the top and pause shipping actions until the request is handled.", "Kërkesat për anulim qëndrojnë lart dhe ndalojnë veprimet e dërgimit derisa kërkesa të trajtohet."],
  ["Total orders", "Totali i porosive"],
  ["All marketplace orders that included your products.", "Të gjitha porositë e tregut që përfshinin produktet tuaja."],
  ["Products that need inventory attention soon.", "Produkte që së shpejti kërkojnë vëmendje në inventar."],
  ["Listed products", "Produkte të listuara"],
  ["Inventory units", "Njësi inventari"],
  ["Total sellable units across your catalog.", "Totali i njësive të shitshme në katalogun tuaj."],
  ["Last activity", "Aktiviteti i fundit"],
  ["Orders waiting for your response", "Porosi në pritje të përgjigjes suaj"],
  ["Recent alerts", "Alarmet e fundit"],
  ["Nothing urgent right now.", "Asgjë urgjente për momentin."],
  ["Product studio", "Studio e produktit"],
  ["Core details", "Detajet kryesore"],
  ["Catalog setup", "Konfigurimi i katalogut"],
  ["Auto subcategory", "Nënkategori automatike"],
  ["Vendors no longer need to choose this manually. It is handled from the category setup in the background.", "Shitësit nuk kanë më nevojë ta zgjedhin manualisht. Kjo menaxhohet nga konfigurimi i kategorisë në sfond."],
  ["Color and size", "Ngjyra dhe madhësia"],
  ["Choose a size type", "Zgjidh llojin e madhësisë"],
  ["Shoes use EU shoe sizes automatically.", "Këpucët përdorin automatikisht madhësitë EU."],
  ["EU shoe sizes", "MadhÃ«sitÃ« EU tÃ« kÃ«pucÃ«ve"],
  ["Images and publish", "Imazhet dhe publikimi"],
  ["Size setup", "Konfigurimi i madhësive"],
  ["Current images", "Imazhet aktuale"],
  ["New uploads", "Ngarkime të reja"],
  ["Cancel edit", "Anulo ndryshimin"],
  ["Missing catalog option?", "Mungon opsion katalogu?"],
  ["Request a missing brand, category, size, or color. Admin will review the request, then create the real value manually in Settings if approved.", "Kërkoni markë, kategori, madhësi ose ngjyrë që mungon. Administratori do ta shqyrtojë kërkesën dhe pastaj do ta krijojë vlerën manualisht te Cilësimet nëse miratohet."],
  ["Request type", "Lloji i kërkesës"],
  ["Requested value", "Vlera e kërkuar"],
  ["Optional note", "Shënim opsional"],
  ["Sort by", "Rendit sipas"],
  ["Newest first", "Më të rejat së pari"],
  ["Oldest first", "Më të vjetrat së pari"],
  ["Most ordered", "Më të porositurat"],
  ["Listing filter", "Filtri i listimit"],
  ["Listed and hidden", "Të listuara dhe të fshehura"],
  ["Listed only", "Vetëm të listuara"],
  ["Hidden only", "Vetëm të fshehura"],
  ["All categories", "Të gjitha kategoritë"],
  ["Clear selection", "Pastro përzgjedhjen"],
  ["All statuses", "Të gjitha statuset"],
  ["No orders are waiting for your response right now.", "Asnjë porosi nuk pret përgjigjen tuaj për momentin."],
  ["No orders for this filter yet.", "Ende nuk ka porosi për këtë filtër."],
  ["Remove from favorites", "Hiq nga të preferuarat"],
  ["Add to favorites", "Shto te të preferuarat"],
  ["Checking your session...", "Po kontrollohet sesioni juaj..."],
  ["Redirecting to sign in...", "Duke ju drejtuar te hyrja..."],
  ["Redirecting to the correct workspace...", "Duke ju drejtuar te hapësira e duhur..."],
  ["Loading settings...", "Cilësimet po ngarkohen..."],
  ["Failed to load settings.", "Cilësimet nuk mund të ngarkoheshin."],
  ["Settings updated.", "Cilësimet u përditësuan."],
  ["Failed to update settings.", "Cilësimet nuk mund të përditësoheshin."],
  ["Vishu.shop", "Vishu.shop"],
  ["Promotion space ready", "Hapësira e promocionit është gati"],
  ["Clear browse filters", "Pastro filtrat e shfletimit"],
  ["All colors", "Të gjitha ngjyrat"],
  ["All sizes", "Të gjitha madhësitë"],
  ["Loading products...", "Produktet po ngarkohen..."],
  ["Searching marketplace...", "Po kërkohet në treg..."],
  ["See all", "Shiko të gjitha"],
  ["No public shops yet.", "Ende nuk ka dyqane publike."],
  ["Choose an available size before adding to cart.", "Zgjidhni një madhësi të disponueshme para se ta shtoni në shportë."],
  ["Failed to load products.", "Produktet nuk mund të ngarkoheshin."],
  ["Failed to search products.", "Kërkimi i produkteve dështoi."],
  ["No products match your current search.", "Asnjë produkt nuk përputhet me kërkimin aktual."],
  ["Scroll all shops left", "Lëviz dyqanet majtas"],
  ["All shops", "Të gjitha dyqanet"],
  ["Scroll all shops right", "Lëviz dyqanet djathtas"],
  ["Loading product...", "Produkti po ngarkohet..."],
  ["Browse shops", "Shfleto dyqanet"],
  ["Unified marketplace listing", "Listim i unifikuar në treg"],
  ["Keep browsing", "Vazhdo shfletimin"],
  ["Failed to load product.", "Produkti nuk mund të ngarkohej."],
  ["Loading shop...", "Dyqani po ngarkohet..."],
  ["Search this shop", "Kërko në këtë dyqan"],
  ["Stock ↓", "Stoku ↓"],
  ["This shop has no public products yet.", "Ky dyqan ende nuk ka produkte publike."],
  ["No products match this shop filter right now.", "Asnjë produkt nuk përputhet me filtrin e këtij dyqani për momentin."],
  ["Go to cart", "Shko te shporta"],
  ["Browse in marketplace", "Shfleto në treg"],
  ["Failed to load shop.", "Dyqani nuk mund të ngarkohej."],
  ["Shop not found.", "Dyqani nuk u gjet."],
  ["Ready now", "Gati tani"],
  ["Show previous promotion", "Shfaq promocionin e mëparshëm"],
  ["Show next promotion", "Shfaq promocionin tjetër"],
  ["Homepage promotion", "Promocioni i kryefaqes"],
  ["Only 1 left in this size.", "Vetëm 1 ka mbetur në këtë madhësi."],
  ["sold out", "e shitur"],
  ["Cancelling...", "Duke anuluar..."],
  ["Approving...", "Duke aprovuar..."],
  ["Approve customer cancellation", "Aprovo anulimin e klientit"],
  ["MEN", "BURRA"],
  ["WOMEN", "GRA"],
  ["KIDS", "FËMIJË"],
  ["BABIES", "BEBE"],
  ["Men", "Burra"],
  ["Women", "Gra"],
  ["Kids", "Fëmijë"],
  ["Babies", "Bebe"],
  ["Male", "Mashkull"],
  ["Female", "Femër"],
  ["Genders", "Gjinitë"],
  ["All genders", "Të gjitha gjinitë"],
  ["T-Shirt", "Bluzë"],
  ["T-Shirts", "Bluza"],
  ["Shirts", "Këmisha"],
  ["Tops", "Bluza të sipërme"],
  ["Hoodie", "Duks"],
  ["Hoodies", "Duks"],
  ["Sweatshirt", "Bluzë sportive"],
  ["Sweatshirts", "Bluza sportive"],
  ["Sweaters", "Triko"],
  ["Jackets", "Xhaketa"],
  ["Outerwear", "Veshje të jashtme"],
  ["Pants", "Pantallona"],
  ["Jeans", "Xhinse"],
  ["Shorts", "Pantallona të shkurtra"],
  ["Underwear", "Të mbrendshme"],
  ["Suits", "Kostume"],
  ["Shoes", "Këpucë"],
  ["Sportswear", "Veshje sportive"],
  ["Accessories", "Aksesorë"],
  ["Beach", "Plazhi"],
  ["Leggings", "Leggings"],
  ["Dresses", "Fustane"],
  ["Skirts", "Funde"],
  ["Set", "Set"],
  ["Sets", "Sete"],
  ["Schoolwear", "Veshje shkolle"],
  ["Bodysuits", "Body për bebe"],
  ["Rompers", "Kominoshe për bebe"],
  ["Sleepwear", "Pizhame"],
  ["Blankets", "Batanije"],
  ["Gift Sets", "Sete dhuratash"],
  ["Black", "E zezë"],
  ["White", "E bardhë"],
  ["Ivory", "Ivory"],
  ["Cream", "Krem"],
  ["Beige", "Bezhë"],
  ["Brown", "Kafe"],
  ["Tan", "E hapur kafe"],
  ["Gray", "Gri"],
  ["Blue", "Blu"],
  ["Navy", "Blu e errët"],
  ["Red", "E kuqe"],
  ["Orange", "Portokalli"],
  ["Yellow", "E verdhë"],
  ["Green", "E gjelbër"],
  ["Olive", "Ulliri"],
  ["Pink", "Rozë"],
  ["Purple", "Vjollcë"],
  ["Burgundy", "Bordo"],
  ["Gold", "Ari"],
  ["Silver", "Argjend"],
  ["Mixed Color", "Të përziera"],
  ["Mixed Colors", "Të përziera"],
  ["Mixed color", "Të përziera"],
  ["Mixed colors", "Të përziera"],
  ["Multicolor", "Të përziera"],
  ["One Size", "Një madhësi"],
  ["Price ↑", "Çmimi ↑"],
  ["Price ↓", "Çmimi ↓"],
  ["A-Z", "A-Z"],
  ["Min price", "Çmimi minimal"],
  ["Max price", "Çmimi maksimal"],
  ["Min", "Min"],
  ["Max", "Maks"],
  ["Colors", "Ngjyrat"],
  ["All departments", "Të gjitha departamentet"],
  ["All stock statuses", "Të gjitha statuset e stokut"],
  ["Stock filter", "Filtri i stokut"],
  ["All stock states", "TÃ« gjitha gjendjet e stokut"],
  ["Bulk stock update", "PÃ«rditÃ«sim masiv i stokut"],
  ["Select shown", "Zgjidh tÃ« shfaqurat"],
  ["New stock for selected", "Stok i ri pÃ«r tÃ« zgjedhurat"],
  ["Stock controls", "Kontrollet e stokut"],
  ["Focus only on stock levels, low-stock alerts, out-of-stock items, and bulk quantity updates.", "Fokusohuni vetëm te nivelet e stokut, alarmet për stok të ulët, produktet pa stok dhe përditësimet masive të sasive."],
  ["Product list", "Lista e produkteve"],
  ["Search and filter your catalog, then edit or manage each product from its own row.", "Kërkoni dhe filtroni katalogun tuaj, pastaj ndryshoni ose menaxhoni çdo produkt nga rreshti i vet."],
  ["Price", "Çmimi"],
  ["Sold", "Shitur"],
  ["Threshold", "Kufiri"],
  ["Refined daily staples, tailoring, and outerwear.", "Bazat e përditshme, rroba serioze dhe veshje të jashtme."],
  ["Dresses, elevated essentials, and seasonal layers.", "Fustane, bazike elegante dhe shtresa sezonale."],
  ["Kidswear, school essentials, and shoes.", "Veshje për fëmijë, bazike shkolle dhe këpucë."],
  ["Soft essentials, newborn sets, and first shoes.", "Bazike të buta, sete për të porsalindur dhe këpucët e para."],
  ["verified", "verifikuar"],
  ["pending", "në pritje"],
  ["shipped", "dërguar"],
  ["confirmed", "konfirmuar"],
  ["requested", "kërkuar"],
  ["returned", "kthyer"],
  ["cancelled", "anuluar"],
  ["delivered", "dorëzuar"],
  ["active", "aktiv"],
  ["inactive", "joaktiv"],
]);

const reverseTextTranslations = new Map(
  Array.from(textTranslations.entries()).map(([english, albanian]) => [
    albanian,
    english,
  ]),
);

const placeholderTranslations = new Map<string, string>([
  ["Search products across the marketplace", "Kërko produkte në të gjithë tregun"],
  ["Search", "Kërko"],
  ["Email", "Email"],
  ["Password", "Fjalëkalimi"],
  ["First name", "Emri"],
  ["Last name", "Mbiemri"],
  ["Phone number", "Numri i telefonit"],
  ["Shop name", "Emri i dyqanit"],
  ["Search products", "Kërko produkte"],
  ["Search orders", "Kërko porosi"],
  ["Short business summary, service notes, or internal shop profile description", "Përmbledhje e shkurtër biznesi, shënime shërbimi ose përshkrim i profilit të dyqanit"],
  ["Street, city, postal code, country", "Rruga, qyteti, kodi postar, shteti"],
  ["Processing time, courier notes, dispatch expectations", "Koha e përpunimit, shënime për korrierin, pritshmëritë e dërgesës"],
  ["Return window, condition requirements, exchange notes", "Afati i kthimit, kushtet e kërkuara, shënime për ndërrim"],
  ["Home, Office, Family", "Shtëpi, Zyrë, Familje"],
  ["Apartment, suite, floor", "Apartament, suitë, kati"],
  ["Optional phone number", "Numër telefoni opsional"],
  ["you@example.com", "ju@example.com"],
  ["Enter the missing option", "Shkruani opsionin që mungon"],
  ["Optional context for admin", "Kontekst opsional për administratorin"],
  ["Title, code, gender, category, color, size", "Titull, kod, gjini, kategori, ngjyrë, madhësi"],
  ["Title, code, color, size", "Titull, kod, ngjyrë, madhësi"],
  ["e.g. 12", "p.sh. 12"],
  ["Mon-Fri 09:00-18:00, Sat 10:00-14:00", "Hën-Prem 09:00-18:00, Sht 10:00-14:00"],
  ["employee@shop.com", "punonjes@dyqani.com"],
  ["Short business summary, service notes, or internal shop profile description", "Përmbledhje e shkurtër biznesi, shënime shërbimi ose përshkrim i profilit të dyqanit"],
  ["Street, city, postal code, country", "Rruga, qyteti, kodi postar, shteti"],
  ["Processing time, courier notes, dispatch expectations", "Koha e përpunimit, shënime për korrierin, pritshmëritë e dërgesës"],
  ["Return window, condition requirements, exchange notes", "Afati i kthimit, kushtet e kërkuara, shënime për ndërrim"],
  ["Enter 6-digit code", "Shkruani kodin 6-shifror"],
  ["Confirm password", "Konfirmo fjalëkalimin"],
  ["Confirm new password", "Konfirmo fjalëkalimin e ri"],
  ["Verification code", "Kodi i verifikimit"],
  ["Street and building", "Rruga dhe ndërtesa"],
  ["Apartment, floor, or local delivery note", "Apartament, kati ose shënim lokal dorëzimi"],
  ["Optional delivery or packaging note", "Shënim opsional për dorëzim ose paketim"],
  ["Optional note", "Shënim opsional"],
  ["Enter OTP code", "Shkruani kodin OTP"],
  ["Search this shop", "Kërko në këtë dyqan"],
  ["Search products", "Kërko produkte"],
  ["Search orders", "Kërko porosi"],
  ["Search", "Kërko"],
  ["Min", "Min"],
  ["Max", "Maks"],
]);

const reversePlaceholderTranslations = new Map(
  Array.from(placeholderTranslations.entries()).map(([english, albanian]) => [
    albanian,
    english,
  ]),
);

function replacePatternText(value: string, language: Language): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (language === "sq") {
    const availableMatch = trimmed.match(/^(\d+)\s+available now$/i);
    if (availableMatch) {
      return value.replace(trimmed, `${availableMatch[1]} në dispozicion tani`);
    }

    const itemsMatch = trimmed.match(/^(\d+)\s+items?$/i);
    if (itemsMatch) {
      return value.replace(trimmed, `${itemsMatch[1]} produkte`);
    }

    const categoriesMatch = trimmed.match(/^(\d+)\s+categories$/i);
    if (categoriesMatch) {
      return value.replace(trimmed, `${categoriesMatch[1]} kategori`);
    }

    const productListingsMatch = trimmed.match(/^(\d+)\s+product listings created\.$/i);
    if (productListingsMatch) {
      return value.replace(trimmed, `${productListingsMatch[1]} listime produktesh u krijuan.`);
    }

    const soldOrdersMatch = trimmed.match(/^(\d+)\s+sold\s+\|\s+(\d+)\s+orders$/i);
    if (soldOrdersMatch) {
      return value.replace(trimmed, `${soldOrdersMatch[1]} të shitura | ${soldOrdersMatch[2]} porosi`);
    }

    const searchMatch = trimmed.match(/^Search:\s+(.+)$/i);
    if (searchMatch) {
      return value.replace(trimmed, `Kërko: ${searchMatch[1]}`);
    }

    const settingsMatch = trimmed.match(/^(.+)\s+Settings$/);
    if (settingsMatch) {
      return value.replace(trimmed, `Cilësimet e ${settingsMatch[1]}`);
    }

    const onlyLeftMatch = trimmed.match(/^Only\s+(\d+)\s+left(?:\s+in\s+this\s+size)?\.$/i);
    if (onlyLeftMatch) {
      return value.replace(trimmed, `Vetëm ${onlyLeftMatch[1]} kanë mbetur${trimmed.toLowerCase().includes("size") ? " në këtë madhësi" : ""}.`);
    }

    const stockMatch = trimmed.match(/^Stock:\s+(\d+)$/i);
    if (stockMatch) {
      return value.replace(trimmed, `Stoku: ${stockMatch[1]}`);
    }

    const stockBareMatch = trimmed.match(/^Stock\s+(\d+)$/i);
    if (stockBareMatch) {
      return value.replace(trimmed, `Stoku ${stockBareMatch[1]}`);
    }

    const selectedSizeStockMatch = trimmed.match(/^Selected size stock:\s+(\d+)$/i);
    if (selectedSizeStockMatch) {
      return value.replace(trimmed, `Stoku i madhësisë së zgjedhur: ${selectedSizeStockMatch[1]}`);
    }

    const availableSizeMatch = trimmed.match(/^(\d+)\s+available\s+in\s+this\s+size\.$/i);
    if (availableSizeMatch) {
      return value.replace(trimmed, `${availableSizeMatch[1]} në dispozicion në këtë madhësi.`);
    }

    const lowStockAtMatch = trimmed.match(/^Low stock at\s+(\d+)\s+units$/i);
    if (lowStockAtMatch) {
      return value.replace(trimmed, `Stok i ulët në ${lowStockAtMatch[1]} njësi`);
    }

    const shownMatch = trimmed.match(/^(\d+)\s+shown$/i);
    if (shownMatch) {
      return value.replace(trimmed, `${shownMatch[1]} të shfaqura`);
    }

    const thresholdMatch = trimmed.match(/^Threshold\s+(.+)$/i);
    if (thresholdMatch) {
      return value.replace(trimmed, `Kufiri ${thresholdMatch[1]}`);
    }

    const priceValueMatch = trimmed.match(/^Price\s+(.+)$/i);
    if (priceValueMatch) {
      return value.replace(trimmed, `Çmimi ${priceValueMatch[1]}`);
    }

    const soldMatch = trimmed.match(/^Sold\s+(\d+)$/i);
    if (soldMatch) {
      return value.replace(trimmed, `Shitur ${soldMatch[1]}`);
    }

    const ordersMatch = trimmed.match(/^Orders\s+(\d+)$/i);
    if (ordersMatch) {
      return value.replace(trimmed, `Porosi ${ordersMatch[1]}`);
    }

    const earningsMatch = trimmed.match(/^Earnings\s+(.+)$/i);
    if (earningsMatch) {
      return value.replace(trimmed, `Fitime ${earningsMatch[1]}`);
    }

    const codeMatch = trimmed.match(/^Code\s+(.+)$/i);
    if (codeMatch) {
      return value.replace(trimmed, `Kodi ${codeMatch[1]}`);
    }

    const colorChipMatch = trimmed.match(/^Color:\s+(.+)$/i);
    if (colorChipMatch) {
      return value.replace(trimmed, `Ngjyra: ${replaceWholeText(colorChipMatch[1], "sq")}`);
    }

    const sizeTypeMatch = trimmed.match(/^(.+)\s+sizes$/i);
    if (sizeTypeMatch) {
      return value.replace(trimmed, `Madhësitë ${replaceWholeText(sizeTypeMatch[1], "sq")}`);
    }

    const selectEverySizeMatch = trimmed.match(/^Select every\s+(.+)\s+size available in stock, then enter stock per size\.$/i);
    if (selectEverySizeMatch) {
      return value.replace(trimmed, `Zgjidh çdo madhësi ${replaceWholeText(selectEverySizeMatch[1], "sq")} që është në stok, pastaj vendos stokun për çdo madhësi.`);
    }

    const categoryHeadingMatch = trimmed.match(/^(Men|Women|Kids|Babies)'s\s+(.+)$/);
    if (categoryHeadingMatch) {
      const prefix = {
        Men: "Për burra",
        Women: "Për gra",
        Kids: "Për fëmijë",
        Babies: "Për bebe",
      }[categoryHeadingMatch[1]];
      return value.replace(trimmed, `${prefix} ${replaceWholeText(categoryHeadingMatch[2], "sq")}`);
    }

    const quantityProductMatch = trimmed.match(/^(\d+)x\s+(.+)$/i);
    if (quantityProductMatch) {
      return value.replace(trimmed, `${quantityProductMatch[1]}x ${quantityProductMatch[2]}`);
    }
  } else {
    const availableMatch = trimmed.match(/^(\d+)\s+në dispozicion tani$/i);
    if (availableMatch) {
      return value.replace(trimmed, `${availableMatch[1]} available now`);
    }

    const itemsMatch = trimmed.match(/^(\d+)\s+produkte$/i);
    if (itemsMatch) {
      return value.replace(trimmed, `${itemsMatch[1]} items`);
    }

    const categoriesMatch = trimmed.match(/^(\d+)\s+kategori$/i);
    if (categoriesMatch) {
      return value.replace(trimmed, `${categoriesMatch[1]} categories`);
    }

    const productListingsMatch = trimmed.match(/^(\d+)\s+listime produktesh u krijuan\.$/i);
    if (productListingsMatch) {
      return value.replace(trimmed, `${productListingsMatch[1]} product listings created.`);
    }

    const soldOrdersMatch = trimmed.match(/^(\d+)\s+të shitura\s+\|\s+(\d+)\s+porosi$/i);
    if (soldOrdersMatch) {
      return value.replace(trimmed, `${soldOrdersMatch[1]} sold | ${soldOrdersMatch[2]} orders`);
    }

    const searchMatch = trimmed.match(/^Kërko:\s+(.+)$/i);
    if (searchMatch) {
      return value.replace(trimmed, `Search: ${searchMatch[1]}`);
    }

    const onlyLeftMatch = trimmed.match(/^Vetëm\s+(\d+)\s+kanë mbetur(?:\s+në këtë madhësi)?\.$/i);
    if (onlyLeftMatch) {
      return value.replace(trimmed, `Only ${onlyLeftMatch[1]} left${trimmed.toLowerCase().includes("madhësi") ? " in this size" : ""}.`);
    }

    const stockMatch = trimmed.match(/^Stoku:\s+(\d+)$/i);
    if (stockMatch) {
      return value.replace(trimmed, `Stock: ${stockMatch[1]}`);
    }
  }

  return value;
}

function replaceWholeText(value: string, language: Language): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  const replacement =
    language === "sq"
      ? textTranslations.get(trimmed)
      : reverseTextTranslations.get(trimmed);

  if (!replacement) {
    return replacePatternText(value, language);
  }

  return value.replace(trimmed, replacement);
}

function translateAttributes(element: Element, language: Language) {
  if (element instanceof HTMLInputElement && element.type === "file") {
    return;
  }

  const attributeMap =
    language === "sq" ? placeholderTranslations : reversePlaceholderTranslations;

  for (const attribute of ["placeholder", "aria-label", "title", "value"]) {
    const current = element.getAttribute(attribute);
    if (!current) {
      continue;
    }

    const next =
      attributeMap.get(current.trim()) ||
      (language === "sq"
        ? textTranslations.get(current.trim())
        : reverseTextTranslations.get(current.trim()));
    if (next) {
      element.setAttribute(attribute, next);
    }
  }
}

function translateElement(root: ParentNode, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, textarea, [data-no-translate]")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  for (const node of nodes) {
    const nextValue = replaceWholeText(node.nodeValue ?? "", language);
    if (nextValue !== node.nodeValue) {
      node.nodeValue = nextValue;
    }
  }

  if (root instanceof Element) {
    translateAttributes(root, language);
  }
  root
    .querySelectorAll?.(
      "input[placeholder], textarea[placeholder], [aria-label], [title], input[type='submit'][value], input[type='button'][value]",
    )
    .forEach((element) => {
      translateAttributes(element, language);
    });
}

export function FrontendLanguageTranslator({
  enabled,
  language,
}: {
  enabled: boolean;
  language: Language;
}) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }

    translateElement(document.body, language);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const textNode = mutation.target as Text;
          const nextValue = replaceWholeText(textNode.nodeValue ?? "", language);
          if (nextValue !== textNode.nodeValue) {
            textNode.nodeValue = nextValue;
          }
          continue;
        }

        if (mutation.type === "attributes") {
          const target = mutation.target;
          if (target instanceof Element) {
            translateElement(target, language);
          }
          continue;
        }

        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            const textNode = node as Text;
            const nextValue = replaceWholeText(textNode.nodeValue ?? "", language);
            if (nextValue !== textNode.nodeValue) {
              textNode.nodeValue = nextValue;
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateElement(node as Element, language);
          }
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-label", "placeholder", "title", "value"],
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [enabled, language]);

  return null;
}
