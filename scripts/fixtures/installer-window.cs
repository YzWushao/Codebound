using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

// Isolated QA app: emulates Electron's window class and a save on WM_CLOSE.
class InstallerWindow {
    delegate IntPtr WindowProc(IntPtr window, uint message, IntPtr w, IntPtr l);
    static WindowProc callback = HandleMessage;
    static string marker;
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct WindowClass {
        public uint style; public IntPtr procedure; public int classExtra,windowExtra;
        public IntPtr instance,icon,cursor,background; public string menu,name;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct Message { public IntPtr window; public uint message; public UIntPtr w; public IntPtr l; public uint time; public int x,y; public uint extra; }
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern ushort RegisterClass(ref WindowClass definition);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int width,int height,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr parameter);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr DefWindowProc(IntPtr window,uint message,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll")] static extern void PostQuitMessage(int code);
    [DllImport("user32.dll")] static extern int GetMessage(out Message message,IntPtr window,uint min,uint max);
    [DllImport("user32.dll")] static extern bool TranslateMessage(ref Message message);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr DispatchMessage(ref Message message);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
    static IntPtr HandleMessage(IntPtr window,uint message,IntPtr w,IntPtr l) {
        if(message==0x10) { Thread.Sleep(700); File.WriteAllText(marker,"saved"); DestroyWindow(window); return IntPtr.Zero; }
        if(message==2) { PostQuitMessage(0); return IntPtr.Zero; }
        return DefWindowProc(window,message,w,l);
    }
    static void Main(string[] args) {
        marker=args[0];
        var definition=new WindowClass { name="Chrome_WidgetWin_1", instance=GetModuleHandle(null), procedure=Marshal.GetFunctionPointerForDelegate(callback) };
        if(RegisterClass(ref definition)==0) Environment.Exit(1);
        if(CreateWindowEx(0,definition.name,"CodeboundInstallerQA · 码境远征",0x00CF0000,0,0,300,200,IntPtr.Zero,IntPtr.Zero,definition.instance,IntPtr.Zero)==IntPtr.Zero) Environment.Exit(2);
        Message message;
        while(GetMessage(out message,IntPtr.Zero,0,0)>0) { TranslateMessage(ref message); DispatchMessage(ref message); }
    }
}
