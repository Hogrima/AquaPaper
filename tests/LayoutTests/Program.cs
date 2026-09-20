using System.Drawing;
using AquaPaper;

int assertions = 0;
void Check(bool passed, string message) { if (!passed) throw new Exception(message); assertions++; }
MonitorInfo[] screens = [new("left",3,false,new(-1920,-160,1920,1080)), new("primary",2,true,new(0,0,1920,1080)), new("right",1,false,new(1920,0,2560,1440))];
var span = WallpaperLayout.Build(new("span"),screens);
Check(span.Count==1 && span[0].Bounds==new Rectangle(-1920,-160,6400,1600),"Span must cover actual physical union");
var all = WallpaperLayout.Build(new("separate"),screens);
Check(all.Count==3,"Separate must create exactly one view per monitor");
for(int i=0;i<3;i++) Check(all[i].Bounds==screens[i].Bounds,"Separate must preserve monitor coordinates");
var single = WallpaperLayout.Build(new("single","right"),screens);
Check(single.Count==1 && single[0].Key=="right","Explicit single selection must win over primary");
var missing = WallpaperLayout.Build(new("single","disconnected"),screens);
Check(missing[0].Key=="primary","Disconnected monitor must temporarily fall back to primary");
var saved = new DisplayOptions("single","left");
Check(WallpaperLayout.Build(saved,screens[1..])[0].Key=="primary","Hot unplug fallback");
Check(WallpaperLayout.Build(saved,screens)[0].Key=="left","Reconnected preferred display restored");
Check(WallpaperLayout.Build(new("invalid"),screens).Count==1,"Corrupt mode falls back safely");
var mapped=span[0].NormalizeCursor(new Point(-960,380));
Check(Math.Abs(mapped.X-.15)<1e-9 && Math.Abs(mapped.Y-.3375)<1e-9 && mapped.Active,"Negative origin cursor normalized in span");
Check(!span[0].NormalizeCursor(new Point(-500,1300)).Active,"Empty area below shorter screen cannot receive cursor");
var left = all[0].NormalizeCursor(new Point(-960,380));
Check(left.X==.5 && left.Y==.5 && left.Active,"Independent screen cursor must be local");
Check(!all[1].NormalizeCursor(new Point(-960,380)).Active,"Cursor must not activate other independent screens");
var edgeA=span[0].NormalizeCursor(new Point(-1,500));var edgeB=span[0].NormalizeCursor(new Point(0,500));
Check(edgeA.Active&&edgeB.Active&&Math.Abs(edgeB.X-edgeA.X-1.0/6400)<1e-9,"Span coordinates must be continuous across a seam");
var one=WallpaperLayout.Build(new("span"),screens[1..2]);Check(one.Count==1&&one[0].Bounds==screens[1].Bounds,"Span must degrade gracefully on one monitor");
for (int total = -1; total <= 12; total++) for (int displays = 1; displays <= 10; displays++) {
    var shares = Enumerable.Range(0, displays).Select(i => WallpaperLayout.PlecoShare(total, displays, i)).ToArray();
    Check(shares.Sum() == Math.Clamp(total, 0, 8), "Global pleco budget must survive any monitor count");
    Check(shares.Max() - shares.Min() <= 1, "Separate displays should share the budget evenly");
}
Check(WallpaperLayout.PlecoShare(8, 3, -1) == 0, "An obsolete wallpaper target gets no plecos");
Console.WriteLine($"Layout tests: {assertions} assertions passed.");
